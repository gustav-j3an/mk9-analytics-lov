-- =========================================================
-- FASE 1B.1 — Estrutura histórica de frequências (Alternativa B)
-- =========================================================

CREATE TABLE public.mk9_industry_store_frequency_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id uuid NOT NULL,
  store_id uuid NOT NULL,
  weekly_frequency numeric,
  monthly_frequency numeric,
  valid_from date NOT NULL,
  valid_until date,
  source_type text NOT NULL,
  source_import_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  notes text,
  CONSTRAINT mk9_isfv_source_type_chk
    CHECK (source_type IN ('IMPORT','MANUAL','SYSTEM','MIGRATION')),
  CONSTRAINT mk9_isfv_weekly_nonneg_chk
    CHECK (weekly_frequency IS NULL OR weekly_frequency >= 0),
  CONSTRAINT mk9_isfv_monthly_nonneg_chk
    CHECK (monthly_frequency IS NULL OR monthly_frequency >= 0),
  CONSTRAINT mk9_isfv_at_least_one_chk
    CHECK (weekly_frequency IS NOT NULL OR monthly_frequency IS NOT NULL),
  CONSTRAINT mk9_isfv_range_chk
    CHECK (valid_until IS NULL OR valid_until >= valid_from),
  -- FKs: industry/store seguem o padrão CASCADE já usado na projeção
  -- (remover a indústria/loja remove suas frequências, atual e histórica).
  CONSTRAINT mk9_isfv_industry_fkey FOREIGN KEY (industry_id)
    REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
  CONSTRAINT mk9_isfv_store_fkey FOREIGN KEY (store_id)
    REFERENCES public.mk9_stores(id) ON DELETE CASCADE,
  -- Importação: SET NULL para nunca destruir versões históricas ao apagar um import.
  CONSTRAINT mk9_isfv_source_import_fkey FOREIGN KEY (source_import_id)
    REFERENCES public.mk9_checklist_imports(id) ON DELETE SET NULL
  -- created_by/updated_by: sem FK para auth.users (schema gerenciado pelo Auth);
  -- a integridade é garantida pela camada de aplicação.
);

COMMENT ON TABLE public.mk9_industry_store_frequency_versions IS
  'Histórico versionado de frequência contratada por indústria/loja. mk9_industry_store_frequency permanece como projeção da versão vigente.';

-- Sobreposição: intervalo semanticamente fechado [valid_from, valid_until]
-- convertido para daterange [from, until+1) — permite 31/07 -> 01/08.
ALTER TABLE public.mk9_industry_store_frequency_versions
  ADD CONSTRAINT mk9_frequency_overlap EXCLUDE USING gist (
    industry_id WITH =,
    store_id WITH =,
    daterange(valid_from, COALESCE(valid_until + 1, 'infinity'::date), '[)') WITH &&
  ) WHERE (archived_at IS NULL);

COMMENT ON CONSTRAINT mk9_frequency_overlap ON public.mk9_industry_store_frequency_versions IS
  'MK9_FREQUENCY_OVERLAP: bloqueia vigências sobrepostas para o mesmo par indústria/loja.';

-- Índices
CREATE INDEX mk9_isfv_industry_idx ON public.mk9_industry_store_frequency_versions (industry_id);
CREATE INDEX mk9_isfv_store_idx ON public.mk9_industry_store_frequency_versions (store_id);
CREATE INDEX mk9_isfv_lookup_idx ON public.mk9_industry_store_frequency_versions (industry_id, store_id, valid_from DESC);
CREATE INDEX mk9_isfv_source_import_idx ON public.mk9_industry_store_frequency_versions (source_import_id)
  WHERE source_import_id IS NOT NULL;
CREATE INDEX mk9_isfv_open_idx ON public.mk9_industry_store_frequency_versions (industry_id, store_id)
  WHERE valid_until IS NULL AND archived_at IS NULL;

-- GRANTs explícitos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_industry_store_frequency_versions TO authenticated;
GRANT ALL ON public.mk9_industry_store_frequency_versions TO service_role;

-- RLS (mesmo padrão da tabela de projeção)
ALTER TABLE public.mk9_industry_store_frequency_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mk9_isfv_select" ON public.mk9_industry_store_frequency_versions
  FOR SELECT TO authenticated
  USING (public.mk9_visible_industry(industry_id));

CREATE POLICY "mk9_isfv_admin_write" ON public.mk9_industry_store_frequency_versions
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());

-- updated_at
CREATE TRIGGER mk9_isfv_touch_updated_at
  BEFORE UPDATE ON public.mk9_industry_store_frequency_versions
  FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();

-- =========================================================
-- Projeção de compatibilidade (trigger)
-- SECURITY DEFINER: precisa escrever na projeção mesmo quando a escrita
-- na tabela histórica vem de contextos com RLS; search_path fixo, sem SQL dinâmico,
-- escreve apenas em mk9_industry_store_frequency, deriva tudo de NEW/OLD.
-- =========================================================
CREATE OR REPLACE FUNCTION public.mk9_project_frequency_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.mk9_industry_store_frequency_versions%ROWTYPE;
BEGIN
  v_row := COALESCE(NEW, OLD);

  -- Só projeta a versão vigente aberta e não arquivada.
  IF NEW IS NOT NULL
     AND NEW.valid_until IS NULL
     AND NEW.archived_at IS NULL
     AND NEW.valid_from <= CURRENT_DATE
  THEN
    INSERT INTO public.mk9_industry_store_frequency
      (industry_id, store_id, weekly_frequency, monthly_frequency, last_import_id)
    VALUES
      (NEW.industry_id, NEW.store_id, NEW.weekly_frequency, NEW.monthly_frequency, NEW.source_import_id)
    ON CONFLICT (industry_id, store_id) DO UPDATE
      SET weekly_frequency = EXCLUDED.weekly_frequency,
          monthly_frequency = EXCLUDED.monthly_frequency,
          last_import_id = EXCLUDED.last_import_id,
          updated_at = now();
  END IF;

  -- Encerramento/arquivamento sem substituta: NÃO apaga a projeção nesta fase.
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.mk9_project_frequency_version() FROM PUBLIC;

CREATE TRIGGER mk9_isfv_project
  AFTER INSERT OR UPDATE ON public.mk9_industry_store_frequency_versions
  FOR EACH ROW EXECUTE FUNCTION public.mk9_project_frequency_version();

-- =========================================================
-- Função de resolução
-- SECURITY INVOKER (padrão): respeita RLS do chamador. Sem privilégio elevado.
-- =========================================================
CREATE OR REPLACE FUNCTION public.mk9_resolve_frequency(
  p_industry_id uuid,
  p_store_id uuid,
  p_reference_date date
)
RETURNS TABLE (
  status text,
  version_id uuid,
  weekly_frequency numeric,
  monthly_frequency numeric,
  valid_from date,
  valid_until date,
  source_type text,
  source_import_id uuid,
  match_count integer
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v public.mk9_industry_store_frequency_versions%ROWTYPE;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.mk9_industry_store_frequency_versions f
  WHERE f.industry_id = p_industry_id
    AND f.store_id = p_store_id
    AND f.archived_at IS NULL
    AND f.valid_from <= p_reference_date
    AND (f.valid_until IS NULL OR f.valid_until >= p_reference_date);

  IF v_count = 0 THEN
    RETURN QUERY SELECT 'UNASSIGNED'::text, NULL::uuid, NULL::numeric, NULL::numeric,
                        NULL::date, NULL::date, NULL::text, NULL::uuid, 0;
    RETURN;
  END IF;

  SELECT * INTO v
  FROM public.mk9_industry_store_frequency_versions f
  WHERE f.industry_id = p_industry_id
    AND f.store_id = p_store_id
    AND f.archived_at IS NULL
    AND f.valid_from <= p_reference_date
    AND (f.valid_until IS NULL OR f.valid_until >= p_reference_date)
  ORDER BY f.valid_from DESC
  LIMIT 1;

  RETURN QUERY SELECT
    CASE WHEN v_count = 1 THEN 'MATCHED' ELSE 'AMBIGUOUS' END::text,
    v.id, v.weekly_frequency, v.monthly_frequency, v.valid_from, v.valid_until,
    v.source_type, v.source_import_id, v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mk9_resolve_frequency(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mk9_resolve_frequency(uuid, uuid, date) TO authenticated, service_role;

-- =========================================================
-- BACKFILL (204 registros) — trigger de projeção desabilitada para
-- garantir que a tabela atual não seja tocada.
-- =========================================================
ALTER TABLE public.mk9_industry_store_frequency_versions DISABLE TRIGGER mk9_isfv_project;

INSERT INTO public.mk9_industry_store_frequency_versions
  (industry_id, store_id, weekly_frequency, monthly_frequency, valid_from, valid_until,
   source_type, source_import_id, created_at, updated_at, notes)
SELECT
  f.industry_id,
  f.store_id,
  f.weekly_frequency,
  f.monthly_frequency,
  CASE WHEN i.name = 'KING' THEN DATE '2026-06-23' ELSE DATE '2026-07-01' END,
  NULL,
  'MIGRATION',
  CASE WHEN EXISTS (SELECT 1 FROM public.mk9_checklist_imports c WHERE c.id = f.last_import_id)
       THEN f.last_import_id ELSE NULL END,
  f.created_at,
  f.updated_at,
  'Backfill inicial sem reconstrução histórica anterior.'
FROM public.mk9_industry_store_frequency f
JOIN public.mk9_industries i ON i.id = f.industry_id
WHERE f.weekly_frequency IS NOT NULL OR f.monthly_frequency IS NOT NULL;

ALTER TABLE public.mk9_industry_store_frequency_versions ENABLE TRIGGER mk9_isfv_project;