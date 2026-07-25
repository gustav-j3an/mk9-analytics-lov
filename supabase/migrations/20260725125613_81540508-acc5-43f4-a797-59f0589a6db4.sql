
-- ============ ENUMS ============
CREATE TYPE public.mk9_industry_status AS ENUM ('DENTRO DA META','ACIMA DA META','ABAIXO DA META','SEM META','OK');
CREATE TYPE public.mk9_visit_status AS ENUM ('planned','completed','cancelled','skipped');
CREATE TYPE public.mk9_sync_mode AS ENUM ('full','add_only','registry_only','routes_only');
CREATE TYPE public.mk9_import_status AS ENUM ('pending','previewing','confirmed','committing','done','failed','cancelled');

-- ============ INDUSTRIES ============
CREATE TABLE public.mk9_industries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_normalized text NOT NULL UNIQUE,
  monthly_contracted_frequency integer,
  monthly_estimated_frequency integer,
  frequency_difference integer,
  frequency_status public.mk9_industry_status,
  weeks_count integer,
  last_import_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_industries TO authenticated;
GRANT ALL ON public.mk9_industries TO service_role;
ALTER TABLE public.mk9_industries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk9_industries_auth" ON public.mk9_industries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ STORES ============
CREATE TABLE public.mk9_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text,
  name text NOT NULL,
  name_normalized text NOT NULL,
  uf text,
  last_import_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name_normalized, uf)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_stores TO authenticated;
GRANT ALL ON public.mk9_stores TO service_role;
ALTER TABLE public.mk9_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk9_stores_auth" ON public.mk9_stores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PROMOTERS ============
CREATE TABLE public.mk9_promoters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  name text NOT NULL,
  name_normalized text NOT NULL,
  city text,
  contact text,
  contact_normalized text,
  notes text,
  last_import_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mk9_promoters_name_norm_idx ON public.mk9_promoters (name_normalized);
CREATE INDEX mk9_promoters_contact_norm_idx ON public.mk9_promoters (contact_normalized);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_promoters TO authenticated;
GRANT ALL ON public.mk9_promoters TO service_role;
ALTER TABLE public.mk9_promoters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk9_promoters_auth" ON public.mk9_promoters FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PLANNED ROUTES (semanal) ============
CREATE TABLE public.mk9_planned_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id uuid NOT NULL REFERENCES public.mk9_promoters(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.mk9_stores(id) ON DELETE CASCADE,
  industry_id uuid NOT NULL REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=dom .. 6=sab
  operation_month smallint NOT NULL CHECK (operation_month BETWEEN 1 AND 12),
  operation_year smallint NOT NULL,
  source_sheet text,
  last_import_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promoter_id, store_id, industry_id, weekday, operation_month, operation_year)
);
CREATE INDEX mk9_planned_routes_period_idx ON public.mk9_planned_routes (operation_year, operation_month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_planned_routes TO authenticated;
GRANT ALL ON public.mk9_planned_routes TO service_role;
ALTER TABLE public.mk9_planned_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk9_planned_routes_auth" ON public.mk9_planned_routes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PLANNED VISITS (datas reais) ============
CREATE TABLE public.mk9_planned_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id uuid NOT NULL REFERENCES public.mk9_promoters(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.mk9_stores(id) ON DELETE CASCADE,
  industry_id uuid NOT NULL REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.mk9_planned_routes(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  status public.mk9_visit_status NOT NULL DEFAULT 'planned',
  completed_at timestamptz,
  notes text,
  source_sheet text,
  last_import_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promoter_id, store_id, industry_id, scheduled_date)
);
CREATE INDEX mk9_planned_visits_date_idx ON public.mk9_planned_visits (scheduled_date);
CREATE INDEX mk9_planned_visits_status_idx ON public.mk9_planned_visits (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_planned_visits TO authenticated;
GRANT ALL ON public.mk9_planned_visits TO service_role;
ALTER TABLE public.mk9_planned_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk9_planned_visits_auth" ON public.mk9_planned_visits FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ IMPORTS ============
CREATE TABLE public.mk9_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_hash text,
  operation_month smallint NOT NULL CHECK (operation_month BETWEEN 1 AND 12),
  operation_year smallint NOT NULL,
  sync_mode public.mk9_sync_mode NOT NULL DEFAULT 'full',
  status public.mk9_import_status NOT NULL DEFAULT 'pending',
  sheets_analyzed jsonb NOT NULL DEFAULT '[]'::jsonb,
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
CREATE INDEX mk9_imports_status_idx ON public.mk9_imports (status);
CREATE INDEX mk9_imports_period_idx ON public.mk9_imports (operation_year, operation_month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_imports TO authenticated;
GRANT ALL ON public.mk9_imports TO service_role;
ALTER TABLE public.mk9_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk9_imports_auth" ON public.mk9_imports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ IMPORT ITEMS ============
CREATE TABLE public.mk9_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.mk9_imports(id) ON DELETE CASCADE,
  sheet text NOT NULL,
  excel_row integer,
  entity_type text NOT NULL, -- industry|store|promoter|frequency|route|visit
  action text NOT NULL,      -- create|update|keep|remove|invalid|ambiguous|duplicate|conflict|preserved
  status text NOT NULL DEFAULT 'planned', -- planned|applied|skipped|failed
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mk9_import_items_import_idx ON public.mk9_import_items (import_id);
CREATE INDEX mk9_import_items_action_idx ON public.mk9_import_items (action);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_import_items TO authenticated;
GRANT ALL ON public.mk9_import_items TO service_role;
ALTER TABLE public.mk9_import_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk9_import_items_auth" ON public.mk9_import_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.mk9_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER mk9_industries_updated_at BEFORE UPDATE ON public.mk9_industries FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();
CREATE TRIGGER mk9_stores_updated_at     BEFORE UPDATE ON public.mk9_stores     FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();
CREATE TRIGGER mk9_promoters_updated_at  BEFORE UPDATE ON public.mk9_promoters  FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();
CREATE TRIGGER mk9_planned_routes_updated_at BEFORE UPDATE ON public.mk9_planned_routes FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();
CREATE TRIGGER mk9_planned_visits_updated_at BEFORE UPDATE ON public.mk9_planned_visits FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();
CREATE TRIGGER mk9_imports_updated_at    BEFORE UPDATE ON public.mk9_imports    FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();
