
CREATE OR REPLACE FUNCTION public.mk9_revert_checklist_import(
  _import_id uuid,
  _reason text,
  _actor uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imp record;
  v_vcount int := 0;
  v_fcount int := 0;
  v_rcount int := 0;
  v_row record;
  v_res jsonb;
BEGIN
  -- 1. Permissão
  PERFORM public.mk9_assert_privileged();
  
  -- 2. Lock e validade
  SELECT * INTO v_imp FROM public.mk9_checklist_imports WHERE id = _import_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Importação não encontrada';
  END IF;
  
  IF v_imp.status = 'reverted' THEN
    RAISE EXCEPTION 'Importação já foi revertida';
  END IF;

  -- 3. Inicia reversão (status transiente)
  UPDATE public.mk9_checklist_imports SET status = 'reverting' WHERE id = _import_id;

  -- 4. Reverter Visitas
  DELETE FROM public.mk9_actual_visits WHERE source_import_id = _import_id;
  GET DIAGNOSTICS v_vcount = ROW_COUNT;

  -- 5. Reverter Reconciliações
  DELETE FROM public.mk9_visit_reconciliations WHERE source_import_id = _import_id;
  GET DIAGNOSTICS v_rcount = ROW_COUNT;

  -- 6. Reverter Frequências
  -- Identifica versões originadas por este import
  FOR v_row IN 
    SELECT * FROM public.mk9_industry_store_frequency_versions 
    WHERE source_import_id = _import_id AND archived_at IS NULL
  LOOP
    -- Arquiva a versão do import
    UPDATE public.mk9_industry_store_frequency_versions 
       SET archived_at = now(), 
           updated_by = COALESCE(_actor, updated_by),
           notes = COALESCE(notes, '') || ' [Reversão da importação ' || _import_id::text || ']'
     WHERE id = v_row.id;
    
    -- Tenta reabrir a versão imediatamente anterior se ela foi encerrada por esta
    -- Uma versão anterior encerrou em (v_row.valid_from - 1)
    UPDATE public.mk9_industry_store_frequency_versions
       SET valid_until = NULL,
           updated_at = now()
     WHERE industry_id = v_row.industry_id
       AND store_id = v_row.store_id
       AND valid_until = (v_row.valid_from - 1)
       AND archived_at IS NULL
       AND NOT EXISTS (
         -- Não reabre se houver outra versão ativa que comece DEPOIS desta que estamos removendo
         SELECT 1 FROM public.mk9_industry_store_frequency_versions v2
         WHERE v2.industry_id = v_row.industry_id
           AND v2.store_id = v_row.store_id
           AND v2.valid_from > v_row.valid_from
           AND v2.archived_at IS NULL
       );
    
    v_fcount := v_fcount + 1;
  END LOOP;

  -- 7. Finaliza importação
  UPDATE public.mk9_checklist_imports
     SET status = 'reverted',
         reverted_at = now(),
         reverted_by = _actor,
         revert_reason = _reason,
         reverted_counters = jsonb_build_object(
           'visits', v_vcount,
           'frequencies', v_fcount,
           'reconciliations', v_rcount
         ),
         updated_at = now()
   WHERE id = _import_id;

  -- 8. Auditoria
  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    _actor, 
    'CHECKLIST_REVERTED', 
    'mk9_checklist_imports', 
    _import_id::text, 
    jsonb_build_object(
      'filename', v_imp.filename,
      'industry_id', v_imp.industry_id,
      'month', v_imp.operation_month,
      'year', v_imp.operation_year,
      'reason', _reason,
      'counts', jsonb_build_object('visits', v_vcount, 'frequencies', v_fcount)
    )
  );

  v_res := jsonb_build_object(
    'ok', true,
    'importId', _import_id,
    'counts', jsonb_build_object('visits', v_vcount, 'frequencies', v_fcount)
  );

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mk9_revert_checklist_import(uuid, text, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mk9_revert_checklist_import(uuid, text, uuid) TO service_role;
