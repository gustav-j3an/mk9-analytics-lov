
ALTER TABLE public.mk9_planned_routes
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'IMPORT',
  ADD COLUMN IF NOT EXISTS source_import_id uuid,
  ADD COLUMN IF NOT EXISTS last_manual_edit_at timestamptz;

-- CHECK só aceita valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mk9_planned_routes_source_type_chk'
  ) THEN
    ALTER TABLE public.mk9_planned_routes
      ADD CONSTRAINT mk9_planned_routes_source_type_chk
      CHECK (source_type IN ('IMPORT','MANUAL'));
  END IF;
END $$;

-- Backfill: rotas existentes vieram do importador
UPDATE public.mk9_planned_routes
   SET source_import_id = COALESCE(source_import_id, last_import_id),
       source_type      = COALESCE(source_type, 'IMPORT')
 WHERE source_import_id IS NULL OR source_type IS NULL;

CREATE INDEX IF NOT EXISTS mk9_planned_routes_source_type_idx
  ON public.mk9_planned_routes(source_type);

-- ============================================================
-- mk9_apply_route_diff: aplica decisões de reimportação de rotas.
--
-- Cada decisão em _decisions[] deve conter:
--   kind: UNCHANGED | NEW_ROUTE | CHANGED_PROMOTER | CHANGED_WEEKDAY
--          | REMOVED_FROM_IMPORT | MANUAL_CONFLICT | FUTURE_VERSION_CONFLICT
--   current_route_id (uuid|null) — versão atual afetada
--   new_route (jsonb|null)       — payload da nova versão
--     { promoter_id, store_id, industry_id, weekday, valid_from,
--       operation_month, operation_year, source_sheet }
--   competency_start (date)      — primeiro dia da competência importada
--
-- Regras:
--   UNCHANGED           -> só atualiza source_import_id / last_import_id
--   NEW_ROUTE           -> INSERT com source_type=IMPORT
--   CHANGED_*           -> fecha atual (valid_until = competency_start - 1) + insere nova
--   REMOVED_FROM_IMPORT -> fecha atual, sem DELETE físico
--   MANUAL_CONFLICT     -> pulada, salvo _force=true (então trata como CHANGED_*)
--   FUTURE_VERSION_CONFLICT -> pulada, salvo _force=true
--
-- Transação atômica: erro em qualquer passo => rollback total.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mk9_apply_route_diff(
  _import_id uuid,
  _decisions jsonb,
  _force boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d            jsonb;
  kind         text;
  cur_id       uuid;
  nw           jsonb;
  comp_start   date;
  close_date   date;
  new_id       uuid;
  n_unchanged  int := 0;
  n_new        int := 0;
  n_changed    int := 0;
  n_removed    int := 0;
  n_skipped    int := 0;
BEGIN
  IF jsonb_typeof(COALESCE(_decisions, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'mk9_apply_route_diff expects _decisions array';
  END IF;

  FOR d IN SELECT jsonb_array_elements(_decisions) LOOP
    kind        := d->>'kind';
    cur_id      := NULLIF(d->>'current_route_id','')::uuid;
    nw          := d->'new_route';
    comp_start  := (d->>'competency_start')::date;
    close_date  := comp_start - 1;

    -- Conflitos sem força: pula, mas registra
    IF (kind = 'MANUAL_CONFLICT' OR kind = 'FUTURE_VERSION_CONFLICT') AND NOT _force THEN
      n_skipped := n_skipped + 1;
      CONTINUE;
    END IF;

    IF kind = 'UNCHANGED' THEN
      UPDATE mk9_planned_routes
         SET last_import_id   = _import_id,
             source_import_id = COALESCE(source_import_id, _import_id),
             updated_at       = now()
       WHERE id = cur_id;
      n_unchanged := n_unchanged + 1;

    ELSIF kind = 'NEW_ROUTE' THEN
      INSERT INTO mk9_planned_routes (
        promoter_id, store_id, industry_id, weekday,
        operation_month, operation_year, source_sheet,
        valid_from, valid_until, is_active, archived_at,
        source_type, source_import_id, last_import_id
      ) VALUES (
        (nw->>'promoter_id')::uuid,
        (nw->>'store_id')::uuid,
        (nw->>'industry_id')::uuid,
        (nw->>'weekday')::smallint,
        (nw->>'operation_month')::smallint,
        (nw->>'operation_year')::smallint,
        nw->>'source_sheet',
        comp_start, NULL, true, NULL,
        'IMPORT', _import_id, _import_id
      );
      n_new := n_new + 1;

    ELSIF kind IN ('CHANGED_PROMOTER','CHANGED_WEEKDAY',
                   'MANUAL_CONFLICT','FUTURE_VERSION_CONFLICT') THEN
      -- Fecha versão atual
      IF cur_id IS NOT NULL THEN
        UPDATE mk9_planned_routes
           SET valid_until = LEAST(COALESCE(valid_until, close_date), close_date),
               updated_at  = now()
         WHERE id = cur_id
           AND valid_from <= close_date;
      END IF;
      -- Cria nova versão
      INSERT INTO mk9_planned_routes (
        promoter_id, store_id, industry_id, weekday,
        operation_month, operation_year, source_sheet,
        valid_from, valid_until, is_active, archived_at,
        source_type, source_import_id, last_import_id
      ) VALUES (
        (nw->>'promoter_id')::uuid,
        (nw->>'store_id')::uuid,
        (nw->>'industry_id')::uuid,
        (nw->>'weekday')::smallint,
        (nw->>'operation_month')::smallint,
        (nw->>'operation_year')::smallint,
        nw->>'source_sheet',
        comp_start, NULL, true, NULL,
        'IMPORT', _import_id, _import_id
      );
      n_changed := n_changed + 1;

    ELSIF kind = 'REMOVED_FROM_IMPORT' THEN
      IF cur_id IS NOT NULL THEN
        UPDATE mk9_planned_routes
           SET valid_until = LEAST(COALESCE(valid_until, close_date), close_date),
               updated_at  = now()
         WHERE id = cur_id
           AND valid_from <= close_date;
        n_removed := n_removed + 1;
      END IF;

    ELSE
      RAISE EXCEPTION 'mk9_apply_route_diff: unknown kind=%', kind;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'unchanged', n_unchanged,
    'new',       n_new,
    'changed',   n_changed,
    'removed',   n_removed,
    'skipped',   n_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mk9_apply_route_diff(uuid, jsonb, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mk9_apply_route_diff(uuid, jsonb, boolean) TO authenticated, service_role;
