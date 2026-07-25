
-- Enum para origem da visita realizada
DO $$ BEGIN
  CREATE TYPE public.mk9_actual_visit_origin AS ENUM ('CHECKLIST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================
-- mk9_checklist_imports
-- ==============================
CREATE TABLE public.mk9_checklist_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_hash text,
  industry_id uuid NOT NULL REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
  operation_month smallint NOT NULL CHECK (operation_month BETWEEN 1 AND 12),
  operation_year smallint NOT NULL CHECK (operation_year BETWEEN 2020 AND 2100),
  status public.mk9_import_status NOT NULL DEFAULT 'pending',
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview jsonb,
  error_message text,
  user_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_checklist_imports TO authenticated;
GRANT ALL ON public.mk9_checklist_imports TO service_role;

ALTER TABLE public.mk9_checklist_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY mk9_checklist_imports_auth ON public.mk9_checklist_imports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_mk9_checklist_imports_updated
  BEFORE UPDATE ON public.mk9_checklist_imports
  FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();

-- ==============================
-- mk9_actual_visits
-- ==============================
CREATE TABLE public.mk9_actual_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id uuid NOT NULL REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.mk9_stores(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  origin public.mk9_actual_visit_origin NOT NULL DEFAULT 'CHECKLIST',
  status text NOT NULL DEFAULT 'completed',
  source_import_id uuid REFERENCES public.mk9_checklist_imports(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mk9_actual_visits_unique UNIQUE (industry_id, store_id, scheduled_date, origin)
);

CREATE INDEX mk9_actual_visits_industry_date_idx
  ON public.mk9_actual_visits (industry_id, scheduled_date);
CREATE INDEX mk9_actual_visits_source_import_idx
  ON public.mk9_actual_visits (source_import_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_actual_visits TO authenticated;
GRANT ALL ON public.mk9_actual_visits TO service_role;

ALTER TABLE public.mk9_actual_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY mk9_actual_visits_auth ON public.mk9_actual_visits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_mk9_actual_visits_updated
  BEFORE UPDATE ON public.mk9_actual_visits
  FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();
