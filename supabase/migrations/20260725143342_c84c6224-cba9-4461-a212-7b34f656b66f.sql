
DO $$ BEGIN
  CREATE TYPE public.mk9_reconciliation_status AS ENUM (
    'MATCHED','DATE_DIVERGENCE','UNPLANNED_VISIT','NOT_COMPLETED',
    'STORE_NOT_FOUND','AMBIGUOUS','DUPLICATE_ACTUAL','MANUALLY_MATCHED','IGNORED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mk9_reconciliation_match_type AS ENUM ('EXACT','NEAR_DATE','MANUAL','NONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.mk9_visit_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_visit_id uuid NULL REFERENCES public.mk9_planned_visits(id) ON DELETE SET NULL,
  actual_visit_id  uuid NULL REFERENCES public.mk9_actual_visits(id)  ON DELETE SET NULL,
  industry_id uuid NOT NULL REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
  store_id    uuid NULL REFERENCES public.mk9_stores(id) ON DELETE SET NULL,
  promoter_id uuid NULL REFERENCES public.mk9_promoters(id) ON DELETE SET NULL,
  source_import_id uuid NULL REFERENCES public.mk9_checklist_imports(id) ON DELETE SET NULL,
  operation_month smallint NOT NULL,
  operation_year  smallint NOT NULL,
  planned_date date NULL,
  actual_date  date NULL,
  date_diff_days integer NULL,
  status public.mk9_reconciliation_status NOT NULL,
  match_score smallint NOT NULL DEFAULT 0,
  match_type  public.mk9_reconciliation_match_type NOT NULL DEFAULT 'NONE',
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_store_name text NULL,
  raw_store_uf   text NULL,
  notes text NULL,
  reviewed_manually boolean NOT NULL DEFAULT false,
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_visit_reconciliations TO authenticated;
GRANT ALL ON public.mk9_visit_reconciliations TO service_role;

ALTER TABLE public.mk9_visit_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mk9_visit_reconciliations_auth ON public.mk9_visit_reconciliations;
CREATE POLICY mk9_visit_reconciliations_auth
  ON public.mk9_visit_reconciliations
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS mk9_reco_industry_period_idx
  ON public.mk9_visit_reconciliations (industry_id, operation_year, operation_month);
CREATE INDEX IF NOT EXISTS mk9_reco_status_idx
  ON public.mk9_visit_reconciliations (status);
CREATE INDEX IF NOT EXISTS mk9_reco_planned_idx
  ON public.mk9_visit_reconciliations (planned_visit_id);
CREATE INDEX IF NOT EXISTS mk9_reco_actual_idx
  ON public.mk9_visit_reconciliations (actual_visit_id);

-- Idempotência: 1 registro por actual_visit_id automático (planned pode ser NULL para UNPLANNED)
CREATE UNIQUE INDEX IF NOT EXISTS mk9_reco_actual_unique
  ON public.mk9_visit_reconciliations (actual_visit_id)
  WHERE actual_visit_id IS NOT NULL;
-- Idempotência: 1 registro NOT_COMPLETED por planejada
CREATE UNIQUE INDEX IF NOT EXISTS mk9_reco_planned_notcompleted_unique
  ON public.mk9_visit_reconciliations (planned_visit_id)
  WHERE actual_visit_id IS NULL AND planned_visit_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_mk9_reco_touch ON public.mk9_visit_reconciliations;
CREATE TRIGGER trg_mk9_reco_touch
  BEFORE UPDATE ON public.mk9_visit_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();
