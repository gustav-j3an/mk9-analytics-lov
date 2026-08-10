-- MK9 ANALYTICS — PREVENÇÃO DE DUPLICIDADE NO ROTEIRO
-- Bloqueia a inserção de rotas idênticas (mesmo promotor, loja, indústria, dia e vigência sobreposta).

CREATE OR REPLACE FUNCTION public.mk9_check_route_exact_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  duplicate_id uuid;
BEGIN
  -- Se o item está sendo arquivado ou desativado, ignoramos.
  IF NEW.is_active = false OR NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Busca se já existe exatamente a mesma rota (mesmo promotor + mesmo contexto) com vigência sobreposta.
  -- A função resolve_route_overlap já trata conflitos entre promotores DIFERENTES.
  -- Esta função trata a duplicidade IDÊNTICA (mesmo promotor).
  SELECT id INTO duplicate_id
    FROM public.mk9_planned_routes
   WHERE id <> NEW.id
     AND promoter_id = NEW.promoter_id
     AND store_id    = NEW.store_id
     AND industry_id = NEW.industry_id
     AND weekday     = NEW.weekday
     AND is_active    = true
     AND archived_at IS NULL
     AND daterange(valid_from,  COALESCE(valid_until,  'infinity'::date), '[]')
      && daterange(NEW.valid_from, COALESCE(NEW.valid_until, 'infinity'::date), '[]')
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Este atendimento já existe no roteiro para este promotor com vigência sobreposta (ID: %).', duplicate_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mk9_planned_routes_exact_duplicate_check ON public.mk9_planned_routes;
CREATE TRIGGER mk9_planned_routes_exact_duplicate_check
BEFORE INSERT OR UPDATE OF store_id, industry_id, weekday, promoter_id, valid_from, valid_until, is_active, archived_at
ON public.mk9_planned_routes
FOR EACH ROW EXECUTE FUNCTION public.mk9_check_route_exact_duplicate();
