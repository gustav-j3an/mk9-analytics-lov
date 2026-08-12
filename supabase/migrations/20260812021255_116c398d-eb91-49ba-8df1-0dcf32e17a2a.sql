CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION mk9_private.is_industry_visit_controlled(p_industry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.mk9_industries
    WHERE id = p_industry_id
    AND control_mode = 'VISIT_CONTROLLED'
    AND archived_at IS NULL
  );
$function$;