CREATE TYPE public.mk9_period_type AS ENUM ('CALENDAR_MONTH','CUSTOM_CYCLE');
CREATE TYPE public.mk9_week_grouping AS ENUM ('CALENDAR_WEEK','CYCLE_WEEK');

CREATE TABLE public.mk9_industry_period_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id uuid NOT NULL UNIQUE REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
  period_type public.mk9_period_type NOT NULL DEFAULT 'CALENDAR_MONTH',
  start_day smallint NOT NULL DEFAULT 1,
  end_day smallint NOT NULL DEFAULT 31,
  uses_previous_month boolean NOT NULL DEFAULT false,
  week_grouping public.mk9_week_grouping NOT NULL DEFAULT 'CALENDAR_WEEK',
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_industry_period_config TO authenticated;
GRANT ALL ON public.mk9_industry_period_config TO service_role;

ALTER TABLE public.mk9_industry_period_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk9_industry_period_config_auth" ON public.mk9_industry_period_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER mk9_industry_period_config_touch
  BEFORE UPDATE ON public.mk9_industry_period_config
  FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();

-- Semeia KING (ciclo 23 → 22)
INSERT INTO public.mk9_industry_period_config
  (industry_id, period_type, start_day, end_day, uses_previous_month, week_grouping, active, notes)
SELECT id, 'CUSTOM_CYCLE', 23, 22, true, 'CYCLE_WEEK', true,
       'Ciclo padrão KING: dia 23 do mês anterior ao dia 22 do mês de competência.'
FROM public.mk9_industries
WHERE name_normalized ILIKE '%king%'
ON CONFLICT (industry_id) DO NOTHING;