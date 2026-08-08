-- 1. Private schema for internal security helpers (not exposed to the Data API)
CREATE SCHEMA IF NOT EXISTS mk9_private;
REVOKE ALL ON SCHEMA mk9_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA mk9_private TO service_role;

-- 2. Move SECURITY DEFINER helpers out of the exposed public schema.
-- Policies reference these by OID, so existing RLS keeps working.
ALTER FUNCTION public.has_mk9_role(uuid, mk9_role) SET SCHEMA mk9_private;
ALTER FUNCTION public.is_mk9_admin() SET SCHEMA mk9_private;
ALTER FUNCTION public.user_has_mk9_scope(text, text) SET SCHEMA mk9_private;
ALTER FUNCTION public.mk9_visible_industry(uuid) SET SCHEMA mk9_private;
ALTER FUNCTION public.mk9_visible_store(text) SET SCHEMA mk9_private;

-- 3. Recreate bodies with the new schema-qualified internal calls.
CREATE OR REPLACE FUNCTION mk9_private.has_mk9_role(user_uuid uuid, required_role mk9_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.mk9_user_roles
    WHERE user_id = user_uuid AND role = required_role
  );
$function$;

CREATE OR REPLACE FUNCTION mk9_private.is_mk9_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT mk9_private.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role);
$function$;

CREATE OR REPLACE FUNCTION mk9_private.user_has_mk9_scope(_scope_type text, _scope_value text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.mk9_user_scopes
     WHERE user_id = auth.uid()
       AND scope_type = _scope_type
       AND scope_value = _scope_value
  );
$function$;

CREATE OR REPLACE FUNCTION mk9_private.mk9_visible_industry(_industry_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    _industry_id IS NULL
    OR mk9_private.is_mk9_admin()
    OR mk9_private.has_mk9_role(auth.uid(), 'AUDITOR'::mk9_role)
    OR (
      mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role)
      AND (
        NOT EXISTS (SELECT 1 FROM public.mk9_user_scopes s
                     WHERE s.user_id = auth.uid() AND s.scope_type = 'INDUSTRY')
        OR EXISTS (SELECT 1 FROM public.mk9_user_scopes s
                    WHERE s.user_id = auth.uid()
                      AND s.scope_type = 'INDUSTRY'
                      AND s.scope_value = _industry_id::text)
      )
    )
    OR (
      mk9_private.has_mk9_role(auth.uid(), 'CLIENTE'::mk9_role)
      AND EXISTS (SELECT 1 FROM public.mk9_user_scopes s
                   WHERE s.user_id = auth.uid()
                     AND s.scope_type = 'INDUSTRY'
                     AND s.scope_value = _industry_id::text)
    );
$function$;

CREATE OR REPLACE FUNCTION mk9_private.mk9_visible_store(_store_uf text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    mk9_private.is_mk9_admin()
    OR mk9_private.has_mk9_role(auth.uid(), 'AUDITOR'::mk9_role)
    OR mk9_private.has_mk9_role(auth.uid(), 'CLIENTE'::mk9_role)
    OR (
      mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role)
      AND (
        NOT EXISTS (SELECT 1 FROM public.mk9_user_scopes s
                     WHERE s.user_id = auth.uid() AND s.scope_type = 'UF')
        OR _store_uf IS NULL
        OR EXISTS (SELECT 1 FROM public.mk9_user_scopes s
                    WHERE s.user_id = auth.uid()
                      AND s.scope_type = 'UF'
                      AND s.scope_value = _store_uf)
      )
    );
$function$;

-- 4. Keep RLS evaluation working for end users without exposing the functions via the API.
REVOKE ALL ON FUNCTION mk9_private.has_mk9_role(uuid, mk9_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION mk9_private.is_mk9_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION mk9_private.user_has_mk9_scope(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION mk9_private.mk9_visible_industry(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mk9_private.mk9_visible_store(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION mk9_private.has_mk9_role(uuid, mk9_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mk9_private.is_mk9_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mk9_private.user_has_mk9_scope(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mk9_private.mk9_visible_industry(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mk9_private.mk9_visible_store(text) TO authenticated, service_role;

-- 5. Scope promoter reads by UF for supervisors (admins/auditors keep full visibility).
DROP POLICY IF EXISTS "mk9_promoters_select" ON public.mk9_promoters;
CREATE POLICY "mk9_promoters_select"
ON public.mk9_promoters
FOR SELECT
TO authenticated
USING (
  mk9_private.is_mk9_admin()
  OR mk9_private.has_mk9_role(auth.uid(), 'AUDITOR'::mk9_role)
  OR (
    mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role)
    AND mk9_private.mk9_visible_store(uf)
  )
);