REVOKE ALL ON FUNCTION public.mk9_project_frequency_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_project_frequency_version() TO service_role;
REVOKE ALL ON FUNCTION public.mk9_resolve_frequency(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mk9_resolve_frequency(uuid, uuid, date) TO authenticated, service_role;