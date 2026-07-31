DO $$
DECLARE
  v_wrong  uuid := '4d64b016-e7d5-4dfc-97d0-fd329557a8e6';
  v_right  uuid := 'b33f2ef5-067b-4d21-848c-0816df1fa1f8';
  v_reason text := 'Correção de divergência com o checklist KING Agosto/2026. O Excel informa 1x/semana e 4x/mês para ATACADÃO ARAGUAÍNA.';
  v_actor  uuid := '5355bcd6-1977-43ce-b71b-5452ce15d088';
BEGIN
  -- 1) Arquiva a versão incorreta (NUNCA delete: histórico preservado).
  UPDATE public.mk9_industry_store_frequency_versions
     SET archived_at = now(),
         updated_by  = v_actor,
         notes       = v_reason || ' Versão gerada por soma indevida de duas linhas do Excel associadas à mesma loja (ATACADÃO ARAGUAÍNA + ATACADÃO ARAGUAÍNA 2).'
   WHERE id = v_wrong
     AND archived_at IS NULL
     AND weekly_frequency = 2
     AND monthly_frequency = 8;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MK9_FIX_WRONG_VERSION_NOT_FOUND';
  END IF;

  -- 2) Antecipa a vigência da versão correta (1x/sem, 4x/mês) para 01/08/2026.
  UPDATE public.mk9_industry_store_frequency_versions
     SET valid_from = DATE '2026-08-01',
         updated_by = v_actor,
         notes      = v_reason
   WHERE id = v_right
     AND archived_at IS NULL
     AND weekly_frequency = 1
     AND monthly_frequency = 4;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MK9_FIX_TARGET_VERSION_NOT_FOUND';
  END IF;

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES
    (v_actor, 'FREQUENCY_VERSION_ARCHIVE', 'mk9_industry_store_frequency_versions', v_wrong,
     jsonb_build_object(
       'industryId', '6f36bb9d-e679-4538-9b58-e6adeb6638e2',
       'storeId', '1d633b3a-a3bb-41ce-bbaf-50610af5a06c',
       'weekly', 2, 'monthly', 8,
       'validFrom', '2026-08-01', 'validUntil', '2026-08-29',
       'rootCause', 'CHECKLIST_IMPORT_DUPLICATE_STORE_SUM',
       'sourceImportId', '7f984d2c-bf95-43d0-be1a-e853ef9e3702',
       'reason', v_reason)),
    (v_actor, 'FREQUENCY_VERSION_BACKDATE', 'mk9_industry_store_frequency_versions', v_right,
     jsonb_build_object(
       'industryId', '6f36bb9d-e679-4538-9b58-e6adeb6638e2',
       'storeId', '1d633b3a-a3bb-41ce-bbaf-50610af5a06c',
       'weekly', 1, 'monthly', 4,
       'validFromBefore', '2026-08-30', 'validFromAfter', '2026-08-01',
       'reason', v_reason));
END $$;