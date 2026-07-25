-- Revogar EXECUTE de anon/public nas funções SECURITY DEFINER (mantém authenticated para as policies)
REVOKE EXECUTE ON FUNCTION public.is_mk9_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_mk9_scope(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mk9_visible_industry(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mk9_visible_store(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_mk9_role(uuid, mk9_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_mk9_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_mk9_scope(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_visible_industry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_visible_store(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_mk9_role(uuid, mk9_role) TO authenticated;

-- Endurecer tabelas de importação (permanecem operadas pelo service_role via server functions)
DROP POLICY IF EXISTS mk9_imports_auth ON public.mk9_imports;
CREATE POLICY mk9_imports_admin_sup ON public.mk9_imports
  FOR ALL TO authenticated
  USING (public.is_mk9_admin() OR public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role))
  WITH CHECK (public.is_mk9_admin() OR public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));

DROP POLICY IF EXISTS mk9_checklist_imports_auth ON public.mk9_checklist_imports;
CREATE POLICY mk9_checklist_imports_admin_sup ON public.mk9_checklist_imports
  FOR ALL TO authenticated
  USING (public.is_mk9_admin() OR public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role))
  WITH CHECK (public.is_mk9_admin() OR public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));

DROP POLICY IF EXISTS mk9_import_items_auth ON public.mk9_import_items;
CREATE POLICY mk9_import_items_admin_sup ON public.mk9_import_items
  FOR ALL TO authenticated
  USING (public.is_mk9_admin() OR public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role))
  WITH CHECK (public.is_mk9_admin() OR public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));

-- Config de período por indústria: leitura para todos autenticados, escrita para ADMIN
DROP POLICY IF EXISTS mk9_industry_period_config_auth ON public.mk9_industry_period_config;
CREATE POLICY mk9_industry_period_config_select ON public.mk9_industry_period_config
  FOR SELECT TO authenticated
  USING (public.mk9_visible_industry(industry_id));
CREATE POLICY mk9_industry_period_config_admin_write ON public.mk9_industry_period_config
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());