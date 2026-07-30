-- ============================================================
-- MK9 — Etapas 3 a 5: gestão manual de frequências contratadas
-- ============================================================

-- 1) Criar/alterar frequência a partir de uma data (versionado)
CREATE OR REPLACE FUNCTION public.mk9_admin_frequency_set(
  _industry_id uuid,
  _store_id uuid,
  _weekly numeric,
  _monthly numeric,
  _effective_date date,
  _reason text DEFAULT NULL,
  _actor uuid DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL,
  _allow_retroactive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := COALESCE(_effective_date, CURRENT_DATE);
  v_cur  public.mk9_industry_store_frequency_versions%ROWTYPE;
  v_new  uuid;
  v_closed uuid;
  v_retro boolean := false;
  v_reason text := NULLIF(btrim(COALESCE(_reason, '')), '');
BEGIN
  PERFORM public.mk9_assert_privileged();

  IF _weekly IS NULL AND _monthly IS NULL THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_VALUE_REQUIRED';
  END IF;
  IF (_weekly IS NOT NULL AND _weekly < 0) OR (_monthly IS NOT NULL AND _monthly < 0) THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_VALUE_INVALID';
  END IF;

  v_retro := v_from < date_trunc('month', CURRENT_DATE)::date;
  IF v_retro AND (NOT _allow_retroactive OR v_reason IS NULL) THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_RETROACTIVE_CONFIRMATION';
  END IF;

  -- Versão vigente na data de efeito (trava a linha dentro da transação)
  SELECT * INTO v_cur
    FROM public.mk9_industry_store_frequency_versions
   WHERE industry_id = _industry_id
     AND store_id = _store_id
     AND archived_at IS NULL
     AND valid_from <= v_from
     AND (valid_until IS NULL OR valid_until >= v_from)
   ORDER BY valid_from DESC
   LIMIT 1
   FOR UPDATE;

  -- Concorrência validada DENTRO da transação
  IF _expected_updated_at IS NOT NULL THEN
    IF v_cur.id IS NULL OR v_cur.updated_at IS DISTINCT FROM _expected_updated_at THEN
      RAISE EXCEPTION 'MK9_FREQUENCY_CONCURRENT_MODIFICATION';
    END IF;
  ELSIF v_cur.id IS NOT NULL THEN
    -- Cliente achava que não havia vigência, mas há: conflito de concorrência.
    RAISE EXCEPTION 'MK9_FREQUENCY_CONCURRENT_MODIFICATION';
  END IF;

  IF v_cur.id IS NOT NULL THEN
    IF v_cur.valid_from <= v_from - 1 THEN
      UPDATE public.mk9_industry_store_frequency_versions
         SET valid_until = LEAST(COALESCE(valid_until, v_from - 1), v_from - 1),
             updated_by  = COALESCE(_actor, updated_by),
             updated_at  = now()
       WHERE id = v_cur.id;
    ELSE
      -- Mesma data de início: a versão anterior nunca teve vigência efetiva.
      UPDATE public.mk9_industry_store_frequency_versions
         SET archived_at = now(),
             updated_by  = COALESCE(_actor, updated_by),
             updated_at  = now()
       WHERE id = v_cur.id;
    END IF;
    v_closed := v_cur.id;
  END IF;

  INSERT INTO public.mk9_industry_store_frequency_versions (
    industry_id, store_id, weekly_frequency, monthly_frequency,
    valid_from, valid_until, source_type, created_by, updated_by, notes
  ) VALUES (
    _industry_id, _store_id, _weekly, _monthly,
    v_from, NULL, 'MANUAL', _actor, _actor, v_reason
  ) RETURNING id INTO v_new;

  RETURN jsonb_build_object(
    'version_id', v_new,
    'closed_version_id', v_closed,
    'retroactive', v_retro,
    'valid_from', v_from
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_OVERLAP';
END;
$function$;

REVOKE ALL ON FUNCTION public.mk9_admin_frequency_set(uuid, uuid, numeric, numeric, date, text, uuid, timestamptz, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mk9_admin_frequency_set(uuid, uuid, numeric, numeric, date, text, uuid, timestamptz, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.mk9_admin_frequency_set(uuid, uuid, numeric, numeric, date, text, uuid, timestamptz, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_admin_frequency_set(uuid, uuid, numeric, numeric, date, text, uuid, timestamptz, boolean) TO service_role;

-- 2) Encerrar uma vigência (sem DELETE)
CREATE OR REPLACE FUNCTION public.mk9_admin_frequency_close(
  _version_id uuid,
  _end_date date,
  _reason text DEFAULT NULL,
  _actor uuid DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cur public.mk9_industry_store_frequency_versions%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(_reason, '')), '');
BEGIN
  PERFORM public.mk9_assert_privileged();

  SELECT * INTO v_cur
    FROM public.mk9_industry_store_frequency_versions
   WHERE id = _version_id
   FOR UPDATE;

  IF v_cur.id IS NULL THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_NOT_FOUND';
  END IF;
  IF v_cur.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_NOT_FOUND';
  END IF;
  IF _expected_updated_at IS NULL OR v_cur.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_CONCURRENT_MODIFICATION';
  END IF;
  IF _end_date IS NULL OR _end_date < v_cur.valid_from THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_END_BEFORE_START';
  END IF;

  UPDATE public.mk9_industry_store_frequency_versions
     SET valid_until = _end_date,
         notes       = COALESCE(v_reason, notes),
         updated_by  = COALESCE(_actor, updated_by),
         updated_at  = now()
   WHERE id = _version_id;

  RETURN jsonb_build_object('version_id', _version_id, 'valid_until', _end_date);
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_OVERLAP';
END;
$function$;

REVOKE ALL ON FUNCTION public.mk9_admin_frequency_close(uuid, date, text, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mk9_admin_frequency_close(uuid, date, text, uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.mk9_admin_frequency_close(uuid, date, text, uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_admin_frequency_close(uuid, date, text, uuid, timestamptz) TO service_role;