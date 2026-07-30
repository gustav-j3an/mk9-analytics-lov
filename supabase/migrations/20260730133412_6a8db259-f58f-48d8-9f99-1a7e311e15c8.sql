-- Divergência entre projeção e vigência atual da frequência (esperado: zero linhas)
CREATE OR REPLACE FUNCTION public.mk9_quality_projection_divergence()
RETURNS TABLE (
  industry_id uuid, store_id uuid,
  projection_weekly numeric, projection_monthly numeric,
  version_weekly numeric, version_monthly numeric,
  version_id uuid, kind text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH current_version AS (
    SELECT DISTINCT ON (v.industry_id, v.store_id)
           v.id, v.industry_id, v.store_id, v.weekly_frequency, v.monthly_frequency
      FROM public.mk9_industry_store_frequency_versions v
     WHERE v.archived_at IS NULL
       AND v.valid_from <= CURRENT_DATE
       AND (v.valid_until IS NULL OR v.valid_until >= CURRENT_DATE)
     ORDER BY v.industry_id, v.store_id, v.valid_from DESC
  )
  SELECT COALESCE(p.industry_id, c.industry_id),
         COALESCE(p.store_id, c.store_id),
         p.weekly_frequency, p.monthly_frequency,
         c.weekly_frequency, c.monthly_frequency,
         c.id,
         CASE WHEN p.industry_id IS NULL THEN 'MISSING_PROJECTION'
              WHEN c.industry_id IS NULL THEN 'ORPHAN_PROJECTION'
              ELSE 'VALUE_MISMATCH' END
    FROM public.mk9_industry_store_frequency p
    FULL OUTER JOIN current_version c
      ON c.industry_id = p.industry_id AND c.store_id = p.store_id
   WHERE p.industry_id IS NULL
      OR c.industry_id IS NULL
      OR COALESCE(p.weekly_frequency, -1)  IS DISTINCT FROM COALESCE(c.weekly_frequency, -1)
      OR COALESCE(p.monthly_frequency, -1) IS DISTINCT FROM COALESCE(c.monthly_frequency, -1);
$$;

-- Estado das proteções estruturais da frequência versionada
CREATE OR REPLACE FUNCTION public.mk9_quality_guard_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'overlapConstraint', EXISTS (
      SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'mk9_industry_store_frequency_versions'
         AND c.contype = 'x'
    ),
    'projectionGuardTrigger', EXISTS (
      SELECT 1 FROM pg_trigger g
        JOIN pg_class t ON t.oid = g.tgrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'mk9_industry_store_frequency'
         AND NOT g.tgisinternal
    ),
    'overlappingRows', (
      SELECT count(*) FROM public.mk9_industry_store_frequency_versions a
        JOIN public.mk9_industry_store_frequency_versions b
          ON b.industry_id = a.industry_id AND b.store_id = a.store_id AND b.id <> a.id
       WHERE a.archived_at IS NULL AND b.archived_at IS NULL
         AND daterange(a.valid_from, COALESCE(a.valid_until,'infinity'::date), '[]')
          && daterange(b.valid_from, COALESCE(b.valid_until,'infinity'::date), '[]')
    )
  );
$$;

-- Contagens do legado operacional (somente informativo)
CREATE OR REPLACE FUNCTION public.mk9_quality_legacy_counts()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'plannedVisits',       (SELECT count(*) FROM public.mk9_planned_visits),
    'visitReconciliations',(SELECT count(*) FROM public.mk9_visit_reconciliations)
  );
$$;

REVOKE ALL ON FUNCTION public.mk9_quality_projection_divergence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_quality_guard_status()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_quality_legacy_counts()         FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_quality_projection_divergence() TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_quality_guard_status()          TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_quality_legacy_counts()         TO service_role;