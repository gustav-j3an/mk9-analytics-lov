
-- 1) Extensão para daterange overlap dentro do trigger
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2) Colunas novas (nullable durante backfill)
ALTER TABLE public.mk9_planned_routes
  ADD COLUMN IF NOT EXISTS valid_from   date,
  ADD COLUMN IF NOT EXISTS valid_until  date,
  ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS created_by   uuid,
  ADD COLUMN IF NOT EXISTS updated_by   uuid;

-- 3) Backfill em cascata (primeiro nível: operation_year/month → primeiro dia).
-- Como fallback, usa created_at::date. Registra origem para relatório.
CREATE TEMP TABLE _mk9_backfill_report AS
SELECT
  CASE
    WHEN valid_from IS NOT NULL                                  THEN 'ja_preenchido'
    WHEN operation_year IS NOT NULL AND operation_month IS NOT NULL
                                                                  THEN 'competencia'
    ELSE                                                              'created_at_fallback'
  END AS origem,
  id
FROM public.mk9_planned_routes;

UPDATE public.mk9_planned_routes
   SET valid_from = make_date(operation_year::int, operation_month::int, 1)
 WHERE valid_from IS NULL
   AND operation_year IS NOT NULL
   AND operation_month IS NOT NULL;

UPDATE public.mk9_planned_routes
   SET valid_from = (created_at AT TIME ZONE 'UTC')::date
 WHERE valid_from IS NULL;

-- 4) Torna obrigatório
ALTER TABLE public.mk9_planned_routes
  ALTER COLUMN valid_from SET NOT NULL;

-- 5) Índice de consulta por vigência
CREATE INDEX IF NOT EXISTS mk9_planned_routes_vigency_lookup_idx
  ON public.mk9_planned_routes (store_id, industry_id, weekday, valid_from)
  WHERE is_active AND archived_at IS NULL;

-- 6) Coerência entre valid_from e valid_until (aceita mudanças históricas)
ALTER TABLE public.mk9_planned_routes
  DROP CONSTRAINT IF EXISTS mk9_planned_routes_period_chk;
ALTER TABLE public.mk9_planned_routes
  ADD CONSTRAINT mk9_planned_routes_period_chk
  CHECK (valid_until IS NULL OR valid_until >= valid_from);

-- 7) Trigger anti-sobreposição real (só bloqueia promotores DIFERENTES no mesmo intervalo)
CREATE OR REPLACE FUNCTION public.mk9_check_route_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  conflict_row record;
BEGIN
  IF NEW.is_active = false OR NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.id, r.promoter_id, r.valid_from, r.valid_until
    INTO conflict_row
    FROM public.mk9_planned_routes r
   WHERE r.id <> NEW.id
     AND r.store_id    = NEW.store_id
     AND r.industry_id = NEW.industry_id
     AND r.weekday     = NEW.weekday
     AND r.is_active    = true
     AND r.archived_at IS NULL
     AND r.promoter_id <> NEW.promoter_id
     AND daterange(r.valid_from,  COALESCE(r.valid_until,  'infinity'::date), '[]')
      && daterange(NEW.valid_from, COALESCE(NEW.valid_until, 'infinity'::date), '[]')
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'MK9_ROUTE_OVERLAP conflict_id=% conflict_promoter=% conflict_from=% conflict_until=%',
      conflict_row.id, conflict_row.promoter_id, conflict_row.valid_from, COALESCE(conflict_row.valid_until::text, 'aberta')
      USING ERRCODE = 'exclusion_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mk9_planned_routes_overlap_check ON public.mk9_planned_routes;
CREATE TRIGGER mk9_planned_routes_overlap_check
BEFORE INSERT OR UPDATE OF store_id, industry_id, weekday, promoter_id,
                          valid_from, valid_until, is_active, archived_at
ON public.mk9_planned_routes
FOR EACH ROW EXECUTE FUNCTION public.mk9_check_route_overlap();

-- 8) Resolver promotor por vigência de rota (fonte de verdade para auditoria)
CREATE OR REPLACE FUNCTION public.mk9_resolve_route_promoter(
  _store_id uuid, _industry_id uuid, _on_date date
)
RETURNS TABLE (
  route_id uuid, promoter_id uuid, weekday smallint,
  valid_from date, valid_until date, match_count int
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT r.id, r.promoter_id, r.weekday, r.valid_from, r.valid_until
      FROM public.mk9_planned_routes r
     WHERE r.store_id    = _store_id
       AND r.industry_id = _industry_id
       AND r.is_active    = true
       AND r.archived_at IS NULL
       AND r.valid_from   <= _on_date
       AND (r.valid_until IS NULL OR r.valid_until >= _on_date)
  ),
  distinct_promoters AS (
    SELECT COUNT(DISTINCT promoter_id) AS n FROM candidates
  )
  SELECT c.id, c.promoter_id, c.weekday, c.valid_from, c.valid_until,
         (SELECT n FROM distinct_promoters)::int
    FROM candidates c
   ORDER BY c.valid_from DESC
   LIMIT 10;
$$;
