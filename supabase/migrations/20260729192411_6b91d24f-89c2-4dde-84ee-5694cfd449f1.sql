-- Fase 0.3: fechar atalho de RPC que contornava as server functions.
REVOKE EXECUTE ON FUNCTION public.mk9_apply_route_diff(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_resolve_route_promoter(uuid, uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mk9_resolve_frequency(uuid, uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mk9_sync_planned_visits(jsonb, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_merge_stores(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Defesa em profundidade: mesmo com EXECUTE, exige service_role ou ADMIN MK9.
CREATE OR REPLACE FUNCTION public.mk9_assert_privileged()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN;
  END IF;
  IF public.is_mk9_admin() THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mk9_assert_privileged() FROM PUBLIC, anon, authenticated;
