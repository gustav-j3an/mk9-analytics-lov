CREATE OR REPLACE FUNCTION public.mk9_set_frequency_manual(
  _industry_id uuid,
  _store_id uuid,
  _weekly numeric,
  _monthly numeric,
  _valid_from date DEFAULT NULL,
  _actor uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := COALESCE(_valid_from, CURRENT_DATE);
  v_cur  public.mk9_industry_store_frequency_versions%ROWTYPE;
  v_new  uuid;
BEGIN
  PERFORM public.mk9_assert_privileged();

  IF _weekly IS NULL AND _monthly IS NULL THEN
    RAISE EXCEPTION 'mk9_set_frequency_manual: informe frequencia semanal ou mensal';
  END IF;

  SELECT * INTO v_cur
    FROM public.mk9_industry_store_frequency_versions
   WHERE industry_id = _industry_id
     AND store_id = _store_id
     AND archived_at IS NULL
     AND valid_from <= v_from
     AND (valid_until IS NULL OR valid_until >= v_from)
   ORDER BY valid_from DESC
   LIMIT 1;

  IF v_cur.id IS NOT NULL THEN
    IF v_cur.valid_from <= v_from - 1 THEN
      UPDATE public.mk9_industry_store_frequency_versions
         SET valid_until = LEAST(COALESCE(valid_until, v_from - 1), v_from - 1),
             updated_by = COALESCE(_actor, updated_by),
             updated_at = now()
       WHERE id = v_cur.id;
    ELSE
      UPDATE public.mk9_industry_store_frequency_versions
         SET archived_at = now(),
             updated_by = COALESCE(_actor, updated_by),
             updated_at = now()
       WHERE id = v_cur.id;
    END IF;
  END IF;

  INSERT INTO public.mk9_industry_store_frequency_versions (
    industry_id, store_id, weekly_frequency, monthly_frequency,
    valid_from, valid_until, source_type, created_by, updated_by, notes
  ) VALUES (
    _industry_id, _store_id, _weekly, _monthly,
    v_from, NULL, 'MANUAL', _actor, _actor, NULLIF(btrim(COALESCE(_reason,'')), '')
  ) RETURNING id INTO v_new;

  RETURN v_new;
END;
$function$;

REVOKE ALL ON FUNCTION public.mk9_set_frequency_manual(uuid, uuid, numeric, numeric, date, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mk9_set_frequency_manual(uuid, uuid, numeric, numeric, date, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.mk9_set_frequency_manual(uuid, uuid, numeric, numeric, date, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_set_frequency_manual(uuid, uuid, numeric, numeric, date, uuid, text) TO service_role;