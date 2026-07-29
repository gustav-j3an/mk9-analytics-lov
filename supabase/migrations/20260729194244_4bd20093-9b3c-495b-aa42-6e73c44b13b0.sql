-- 1) RPC: superseder versões iniciadas na própria competência via arquivamento
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
  cur_from    date;
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

    cur_from := NULL;
    IF cur_id IS NOT NULL THEN
      SELECT valid_from INTO cur_from FROM mk9_industry_store_frequency_versions WHERE id = cur_id;
    END IF;

    IF kind = 'REMOVED_FROM_IMPORT' THEN
      IF cur_id IS NOT NULL THEN
        IF cur_from <= close_date THEN
          UPDATE mk9_industry_store_frequency_versions
             SET valid_until = LEAST(COALESCE(valid_until, close_date), close_date),
                 updated_by  = COALESCE(_actor, updated_by),
                 updated_at  = now()
           WHERE id = cur_id;
        ELSE
          -- versão criada dentro da própria competência: arquiva (histórico preservado)
          UPDATE mk9_industry_store_frequency_versions
             SET archived_at = now(),
                 updated_by  = COALESCE(_actor, updated_by),
                 updated_at  = now()
           WHERE id = cur_id;
        END IF;
        n_removed := n_removed + 1;
      END IF;
      CONTINUE;
    END IF;

    IF kind NOT IN ('NEW_FREQUENCY','CHANGED_FREQUENCY','MANUAL_CONFLICT','FUTURE_VERSION_CONFLICT') THEN
      RAISE EXCEPTION 'mk9_apply_frequency_diff: unknown kind=%', kind;
    END IF;

    -- Encerra/arquiva versão anterior. Nunca UPDATE de valores, nunca DELETE.
    IF cur_id IS NOT NULL THEN
      IF cur_from <= close_date THEN
        UPDATE mk9_industry_store_frequency_versions
           SET valid_until = LEAST(COALESCE(valid_until, close_date), close_date),
               updated_by  = COALESCE(_actor, updated_by),
               updated_at  = now()
         WHERE id = cur_id;
      ELSE
        UPDATE mk9_industry_store_frequency_versions
           SET archived_at = now(),
               updated_by  = COALESCE(_actor, updated_by),
               updated_at  = now()
         WHERE id = cur_id;
      END IF;
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

-- 2) Teste funcional com fixtures temporárias
DO $$
DECLARE
  v_ind uuid; v_store uuid; v_v1 uuid; v_m numeric; v_cnt int; v_hist int;
  v_blocked boolean := false; v_res jsonb; v_imp uuid;
BEGIN
  INSERT INTO public.mk9_industries(name, name_normalized)
  VALUES ('__TESTE_FREQ_1B2__', '__teste_freq_1b2__') RETURNING id INTO v_ind;
  INSERT INTO public.mk9_stores(name, name_normalized)
  VALUES ('__TESTE_FREQ_1B2_LOJA__', '__teste_freq_1b2_loja__') RETURNING id INTO v_store;

  INSERT INTO public.mk9_industry_store_frequency_versions(industry_id,store_id,monthly_frequency,valid_from,source_type)
  VALUES (v_ind,v_store,4,CURRENT_DATE - 40,'IMPORT') RETURNING id INTO v_v1;

  SELECT monthly_frequency INTO v_m FROM public.mk9_industry_store_frequency WHERE industry_id=v_ind AND store_id=v_store;
  IF v_m <> 4 THEN RAISE EXCEPTION 'TESTE FALHOU: projecao inicial=% esperado 4', v_m; END IF;

  BEGIN
    UPDATE public.mk9_industry_store_frequency SET monthly_frequency = 999 WHERE industry_id=v_ind AND store_id=v_store;
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'TESTE FALHOU: escrita direta na projecao foi permitida'; END IF;

  -- CHANGED via RPC (competência = mês corrente)
  v_res := public.mk9_apply_frequency_diff(
    NULL,
    jsonb_build_array(jsonb_build_object(
      'kind','CHANGED_FREQUENCY','current_version_id',v_v1,
      'competency_start', date_trunc('month', CURRENT_DATE)::date,
      'new_version', jsonb_build_object('industry_id',v_ind,'store_id',v_store,'weekly_frequency',NULL,'monthly_frequency',7)
    )), false, NULL, NULL);
  IF (v_res->>'changed')::int <> 1 THEN RAISE EXCEPTION 'TESTE FALHOU: changed=%', v_res; END IF;

  SELECT monthly_frequency INTO v_m FROM public.mk9_industry_store_frequency WHERE industry_id=v_ind AND store_id=v_store;
  IF v_m <> 7 THEN RAISE EXCEPTION 'TESTE FALHOU: projecao apos alteracao=% esperado 7', v_m; END IF;

  -- Reimportação da MESMA competência com valor diferente (supersede/arquivamento)
  v_res := public.mk9_apply_frequency_diff(
    NULL,
    jsonb_build_array(jsonb_build_object(
      'kind','CHANGED_FREQUENCY',
      'current_version_id',(SELECT id FROM public.mk9_industry_store_frequency_versions
                             WHERE industry_id=v_ind AND store_id=v_store AND archived_at IS NULL AND valid_until IS NULL),
      'competency_start', date_trunc('month', CURRENT_DATE)::date,
      'new_version', jsonb_build_object('industry_id',v_ind,'store_id',v_store,'weekly_frequency',NULL,'monthly_frequency',9)
    )), false, NULL, NULL);
  SELECT monthly_frequency INTO v_m FROM public.mk9_industry_store_frequency WHERE industry_id=v_ind AND store_id=v_store;
  IF v_m <> 9 THEN RAISE EXCEPTION 'TESTE FALHOU: supersede mesma competencia=% esperado 9', v_m; END IF;

  -- Conflito sem force é apenas pulado
  v_res := public.mk9_apply_frequency_diff(
    NULL,
    jsonb_build_array(jsonb_build_object(
      'kind','MANUAL_CONFLICT','current_version_id',NULL,
      'competency_start', date_trunc('month', CURRENT_DATE)::date,
      'new_version', jsonb_build_object('industry_id',v_ind,'store_id',v_store,'weekly_frequency',NULL,'monthly_frequency',1)
    )), false, NULL, NULL);
  IF (v_res->>'skipped')::int <> 1 THEN RAISE EXCEPTION 'TESTE FALHOU: conflito sem force nao foi pulado: %', v_res; END IF;

  -- Force sem justificativa deve falhar
  v_blocked := false;
  BEGIN
    PERFORM public.mk9_apply_frequency_diff(NULL, '[]'::jsonb, true, NULL, NULL);
  EXCEPTION WHEN others THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'TESTE FALHOU: force sem justificativa foi aceito'; END IF;

  -- REMOVED encerra vigência e some da projeção, histórico permanece
  v_res := public.mk9_apply_frequency_diff(
    NULL,
    jsonb_build_array(jsonb_build_object(
      'kind','REMOVED_FROM_IMPORT',
      'current_version_id',(SELECT id FROM public.mk9_industry_store_frequency_versions
                             WHERE industry_id=v_ind AND store_id=v_store AND archived_at IS NULL AND valid_until IS NULL),
      'competency_start', date_trunc('month', CURRENT_DATE)::date,
      'new_version', NULL
    )), false, NULL, NULL);
  IF (v_res->>'removed')::int <> 1 THEN RAISE EXCEPTION 'TESTE FALHOU: removed=%', v_res; END IF;

  SELECT count(*) INTO v_cnt FROM public.mk9_industry_store_frequency WHERE industry_id=v_ind AND store_id=v_store;
  SELECT count(*) INTO v_hist FROM public.mk9_industry_store_frequency_versions WHERE industry_id=v_ind AND store_id=v_store;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'TESTE FALHOU: projecao deveria sumir, achou % linhas', v_cnt; END IF;
  IF v_hist <> 3 THEN RAISE EXCEPTION 'TESTE FALHOU: historico deveria ter 3 versoes, achou %', v_hist; END IF;

  RAISE NOTICE 'TESTE 1B.2 OK: guarda, projecao, versionamento, supersede, force e historico validados';

  PERFORM set_config('mk9.frequency_projection','on',true);
  DELETE FROM public.mk9_industry_store_frequency_versions WHERE industry_id=v_ind;
  DELETE FROM public.mk9_stores WHERE id=v_store;
  DELETE FROM public.mk9_industries WHERE id=v_ind;
  PERFORM set_config('mk9.frequency_projection','off',true);
END $$;