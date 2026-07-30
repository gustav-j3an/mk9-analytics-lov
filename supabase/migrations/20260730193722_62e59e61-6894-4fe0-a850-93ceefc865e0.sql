CREATE TABLE IF NOT EXISTS public.mk9_industry_contract_totals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id uuid NOT NULL REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
  competence_month smallint NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
  competence_year smallint NOT NULL CHECK (competence_year BETWEEN 2000 AND 2100),
  period_start date,
  period_end date,
  contracted_total numeric NOT NULL CHECK (contracted_total >= 0),
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  source_type text NOT NULL DEFAULT 'MANUAL' CHECK (source_type IN ('MANUAL','IMPORT','MIGRATION','SYSTEM')),
  source_import_id uuid,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS mk9_ict_active_uq
  ON public.mk9_industry_contract_totals (industry_id, competence_year, competence_month)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS mk9_ict_industry_idx
  ON public.mk9_industry_contract_totals (industry_id, competence_year, competence_month);

GRANT ALL ON public.mk9_industry_contract_totals TO service_role;

ALTER TABLE public.mk9_industry_contract_totals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mk9_ict_service_role_all" ON public.mk9_industry_contract_totals;
CREATE POLICY "mk9_ict_service_role_all"
  ON public.mk9_industry_contract_totals FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.mk9_ict_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS mk9_ict_touch_trg ON public.mk9_industry_contract_totals;
CREATE TRIGGER mk9_ict_touch_trg
  BEFORE UPDATE ON public.mk9_industry_contract_totals
  FOR EACH ROW EXECUTE FUNCTION public.mk9_ict_touch();

-- ---------------------------------------------------------------------------
-- Registrar / atualizar o total contratado (versionado: arquiva o anterior)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_admin_contract_total_set(
  _industry_id uuid,
  _month smallint,
  _year smallint,
  _total numeric,
  _period_start date DEFAULT NULL,
  _period_end date DEFAULT NULL,
  _notes text DEFAULT NULL,
  _actor uuid DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cur public.mk9_industry_contract_totals%ROWTYPE;
  v_new uuid;
BEGIN
  PERFORM public.mk9_assert_privileged();

  IF _total IS NULL OR _total < 0 THEN
    RAISE EXCEPTION 'MK9_CONTRACT_TOTAL_INVALID';
  END IF;

  SELECT * INTO v_cur
    FROM public.mk9_industry_contract_totals
   WHERE industry_id = _industry_id
     AND competence_year = _year
     AND competence_month = _month
     AND archived_at IS NULL
   LIMIT 1
   FOR UPDATE;

  IF _expected_updated_at IS NOT NULL THEN
    IF v_cur.id IS NULL OR v_cur.updated_at IS DISTINCT FROM _expected_updated_at THEN
      RAISE EXCEPTION 'MK9_CONTRACT_TOTAL_CONCURRENT_MODIFICATION';
    END IF;
  ELSIF v_cur.id IS NOT NULL THEN
    RAISE EXCEPTION 'MK9_CONTRACT_TOTAL_CONCURRENT_MODIFICATION';
  END IF;

  IF v_cur.id IS NOT NULL THEN
    UPDATE public.mk9_industry_contract_totals
       SET archived_at = now(), valid_until = CURRENT_DATE,
           updated_by = COALESCE(_actor, updated_by), updated_at = now()
     WHERE id = v_cur.id;
  END IF;

  INSERT INTO public.mk9_industry_contract_totals (
    industry_id, competence_month, competence_year, period_start, period_end,
    contracted_total, source_type, notes, created_by, updated_by
  ) VALUES (
    _industry_id, _month, _year, _period_start, _period_end,
    _total, 'MANUAL', NULLIF(btrim(COALESCE(_notes,'')),''), _actor, _actor
  ) RETURNING id INTO v_new;

  RETURN jsonb_build_object('id', v_new, 'archived_id', v_cur.id);
END; $$;

REVOKE ALL ON FUNCTION public.mk9_admin_contract_total_set(uuid, smallint, smallint, numeric, date, date, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_admin_contract_total_set(uuid, smallint, smallint, numeric, date, date, text, uuid, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- Aplicação em lote (transacional: falha em qualquer loja = rollback total)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_admin_frequency_bulk_apply(
  _industry_id uuid,
  _items jsonb,
  _actor uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _allow_retroactive boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_res jsonb;
  v_applied int := 0;
  v_ids uuid[] := '{}';
BEGIN
  PERFORM public.mk9_assert_privileged();

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_BULK_INVALID_PAYLOAD';
  END IF;
  IF jsonb_array_length(_items) > 5000 THEN
    RAISE EXCEPTION 'MK9_FREQUENCY_BULK_TOO_LARGE';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_res := public.mk9_admin_frequency_set(
      _industry_id,
      (v_item->>'store_id')::uuid,
      NULLIF(v_item->>'weekly','')::numeric,
      NULLIF(v_item->>'monthly','')::numeric,
      (v_item->>'effective_date')::date,
      _reason,
      _actor,
      NULLIF(v_item->>'expected_updated_at','')::timestamptz,
      _allow_retroactive
    );
    v_applied := v_applied + 1;
    v_ids := v_ids || ((v_res->>'version_id')::uuid);
  END LOOP;

  RETURN jsonb_build_object('applied', v_applied, 'version_ids', to_jsonb(v_ids));
END; $$;

REVOKE ALL ON FUNCTION public.mk9_admin_frequency_bulk_apply(uuid, jsonb, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_admin_frequency_bulk_apply(uuid, jsonb, uuid, text, boolean) TO service_role;