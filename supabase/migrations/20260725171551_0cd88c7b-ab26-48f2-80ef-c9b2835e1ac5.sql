
CREATE TABLE public.mk9_industry_store_frequency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id uuid NOT NULL,
  store_id uuid NOT NULL,
  weekly_frequency numeric,
  monthly_frequency numeric,
  last_import_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mk9_isf_unique UNIQUE (industry_id, store_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_industry_store_frequency TO authenticated;
GRANT ALL ON public.mk9_industry_store_frequency TO service_role;

ALTER TABLE public.mk9_industry_store_frequency ENABLE ROW LEVEL SECURITY;

CREATE POLICY mk9_isf_auth
  ON public.mk9_industry_store_frequency
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER mk9_isf_touch_updated_at
  BEFORE UPDATE ON public.mk9_industry_store_frequency
  FOR EACH ROW
  EXECUTE FUNCTION public.mk9_touch_updated_at();

CREATE INDEX mk9_isf_industry_idx ON public.mk9_industry_store_frequency (industry_id);
CREATE INDEX mk9_isf_store_idx ON public.mk9_industry_store_frequency (store_id);
