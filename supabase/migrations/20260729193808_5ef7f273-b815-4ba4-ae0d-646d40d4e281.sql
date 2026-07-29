-- =========================================================================
-- FASE 1B.2 — Versionamento das frequências (escrita)
-- =========================================================================

-- 1) Projeção: recalcula a vigente para (industry, store) em qualquer evento
CREATE OR REPLACE FUNCTION public.mk9_project_frequency_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.mk9_industry_store_frequency_versions%ROWTYPE;
  v_cur public.mk9_industry_store_frequency_versions%ROWTYPE;
BEGIN
  v_row := COALESCE(NEW, OLD);

  SELECT * INTO v_cur
    FROM public.mk9_industry_store_frequency_versions
   WHERE industry_id = v_row.industry_id
     AND store_id = v_row.store_id
     AND archived_at IS NULL
     AND valid_from <= CURRENT_DATE
     AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
   ORDER BY valid_from DESC
   LIMIT 1;

  PERFORM set_config('mk9.frequency_projection', 'on', true);

  IF v_cur.id IS NOT NULL THEN
    INSERT INTO public.mk9_industry_store_frequency
      (industry_id, store_id, weekly_frequency, monthly_frequency, last_import_id)
    VALUES
      (v_cur.industry_id, v_cur.store_id, v_cur.weekly_frequency, v_cur.monthly_frequency, v_cur.source_import_id)
    ON CONFLICT (industry_id, store_id) DO UPDATE
      SET weekly_frequency  = EXCLUDED.weekly_frequency,
          monthly_frequency = EXCLUDED.monthly_frequency,
          last_import_id    = COALESCE(EXCLUDED.last_import_id, public.mk9_industry_store_frequency.last_import_id),
          updated_at        = now();
  ELSE
    -- Nenhuma versão vigente hoje: a projeção (cache derivado) deixa de existir.
    -- O histórico permanece intacto na tabela de versões.
    DELETE FROM public.mk9_industry_store_frequency
     WHERE industry_id = v_row.industry_id
       AND store_id = v_row.store_id;
  END IF;

  PERFORM set_config('mk9.frequency_projection', 'off', true);
  RETURN v_row;
END;
$function$;

-- 2) Guarda: bloqueia gravação direta na projeção
CREATE OR REPLACE FUNCTION public.mk9_guard_frequency_projection()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(current_setting('mk9.frequency_projection', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'mk9_industry_store_frequency e somente projecao: escreva em mk9_industry_store_frequency_versions'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS mk9_guard_frequency_projection_trg ON public.mk9_industry_store_frequency;
CREATE TRIGGER mk9_guard_frequency_projection_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.mk9_industry_store_frequency
  FOR EACH ROW EXECUTE FUNCTION public.mk9_guard_frequency_projection();

-- 3) merge_stores continua podendo consolidar a projeção
CREATE OR REPLACE FUNCTION public.mk9_merge_stores(canonical uuid, other uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF canonical = other THEN RETURN; END IF;

  PERFORM set_config('mk9.frequency_projection', 'on', true);

  INSERT INTO mk9_industry_store_frequency (industry_id, store_id, weekly_frequency, monthly_frequency, last_import_id)
    SELECT industry_id, canonical, weekly_frequency, monthly_frequency, last_import_id
      FROM mk9_industry_store_frequency
     WHERE store_id = other
  ON CONFLICT (industry_id, store_id) DO UPDATE
    SET weekly_frequency  = COALESCE(mk9_industry_store_frequency.weekly_frequency, 0) + COALESCE(EXCLUDED.weekly_frequency, 0),
        monthly_frequency = COALESCE(mk9_industry_store_frequency.monthly_frequency, 0) + COALESCE(EXCLUDED.monthly_frequency, 0),
        last_import_id    = COALESCE(EXCLUDED.last_import_id, mk9_industry_store_frequency.last_import_id);
  DELETE FROM mk9_industry_store_frequency WHERE store_id = other;

  PERFORM set_config('mk9.frequency_projection', 'off', true);

  DELETE FROM mk9_actual_visits av
   WHERE av.store_id = other
     AND EXISTS (
       SELECT 1 FROM mk9_actual_visits av2
        WHERE av2.store_id = canonical
          AND av2.industry_id = av.industry_id
          AND av2.scheduled_date = av.scheduled_date
          AND av2.origin = av.origin
     );
  UPDATE mk9_actual_visits SET store_id = canonical WHERE store_id = other;

  UPDATE mk9_planned_visits SET store_id = canonical WHERE store_id = other;
  UPDATE mk9_planned_routes SET store_id = canonical WHERE store_id = other;
  UPDATE mk9_visit_reconciliations SET store_id = canonical WHERE store_id = other;

  DELETE FROM mk9_stores WHERE id = other;
END;
$function$;

-- 4) RPC transacional de aplicação do diff de frequências
CREATE OR REPLACE FUNCTION public.mk9_apply_frequency_diff(
  _import_id uuid,
  _decisions jsonb,
  _force boolean DEFAULT false,
  _reason text DEFAULT NULL,
  _actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d           jsonb;
  kind        text;
  cur_id      uuid;
  nw          jsonb;
  comp_start  date;
  close_date  date;
  n_unchanged int := 0;
  n_new       int := 0;
  n_changed   int := 0;
  n_removed   int := 0;
  n_skipped   int := 0;
  n_forced    int := 0;
BEGIN
  PERFORM public.mk9_assert_privileged();

  IF jsonb_typeof(COALESCE(_decisions, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'mk9_apply_frequency_diff expects _decisions array';
  END IF;

  IF _force AND COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'mk9_apply_frequency_diff: force exige justificativa';
  END IF;

  FOR d IN SELECT jsonb_array_elements(_decisions) LOOP
    kind       := d->>'kind';
    cur_id     := NULLIF(d->>'current_version_id','')::uuid;
    nw         := d->'new_version';
    comp_start := (d->>'competency_start')::date;
    close_date := comp_start - 1;

    IF kind = 'UNCHANGED' THEN
      UPDATE mk9_industry_store_frequency_versions
         SET source_import_id = COALESCE(source_import_id, _import_id),
             updated_at = now()
       WHERE id = cur_id
         AND source_import_id IS NULL;
      n_unchanged := n_unchanged + 1;
      CONTINUE;
    END IF;

    IF kind IN ('MANUAL_CONFLICT','FUTURE_VERSION_CONFLICT') AND NOT _force THEN
      n_skipped := n_skipped + 1;
      CONTINUE;
    END IF;

    IF kind IN ('MANUAL_CONFLICT','FUTURE_VERSION_CONFLICT') THEN
      n_forced := n_forced + 1;
    END IF;

    IF kind = 'REMOVED_FROM_IMPORT' THEN
      IF cur_id IS NOT NULL THEN
        UPDATE mk9_industry_store_frequency_versions
           SET valid_until = LEAST(COALESCE(valid_until, close_date), close_date),
               updated_by  = COALESCE(_actor, updated_by),
               updated_at  = now()
         WHERE id = cur_id
           AND valid_from <= close_date;
        n_removed := n_removed + 1;
      END IF;
      CONTINUE;
    END IF;

    IF kind NOT IN ('NEW_FREQUENCY','CHANGED_FREQUENCY','MANUAL_CONFLICT','FUTURE_VERSION_CONFLICT') THEN
      RAISE EXCEPTION 'mk9_apply_frequency_diff: unknown kind=%', kind;
    END IF;

    -- Encerra vigência anterior (nunca UPDATE de valores, nunca DELETE)
    IF cur_id IS NOT NULL THEN
      UPDATE mk9_industry_store_frequency_versions
         SET valid_until = LEAST(COALESCE(valid_until, close_date), close_date),
             updated_by  = COALESCE(_actor, updated_by),
             updated_at  = now()
       WHERE id = cur_id
         AND valid_from <= close_date;
    END IF;

    INSERT INTO mk9_industry_store_frequency_versions (
      industry_id, store_id, weekly_frequency, monthly_frequency,
      valid_from, valid_until, source_type, source_import_id,
      created_by, updated_by, notes
    ) VALUES (
      (nw->>'industry_id')::uuid,
      (nw->>'store_id')::uuid,
      NULLIF(nw->>'weekly_frequency','')::numeric,
      NULLIF(nw->>'monthly_frequency','')::numeric,
      comp_start, NULL, 'IMPORT', _import_id,
      _actor, _actor,
      CASE WHEN kind IN ('MANUAL_CONFLICT','FUTURE_VERSION_CONFLICT')
           THEN 'FORCE: ' || COALESCE(_reason, '') ELSE NULL END
    );

    IF kind = 'NEW_FREQUENCY' THEN
      n_new := n_new + 1;
    ELSE
      n_changed := n_changed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'unchanged', n_unchanged,
    'new',       n_new,
    'changed',   n_changed,
    'removed',   n_removed,
    'skipped',   n_skipped,
    'forced',    n_forced
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mk9_apply_frequency_diff(uuid, jsonb, boolean, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mk9_apply_frequency_diff(uuid, jsonb, boolean, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mk9_apply_frequency_diff(uuid, jsonb, boolean, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_apply_frequency_diff(uuid, jsonb, boolean, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mk9_guard_frequency_projection() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mk9_merge_stores(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mk9_merge_stores(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mk9_merge_stores(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_merge_stores(uuid, uuid) TO service_role;