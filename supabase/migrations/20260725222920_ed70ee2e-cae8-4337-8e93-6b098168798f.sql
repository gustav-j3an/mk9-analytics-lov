-- ============================================================
-- 1. Backup lógico das policies atuais
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mk9_rls_policy_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  schemaname text,
  tablename text,
  policyname text,
  permissive text,
  roles name[],
  cmd text,
  qual text,
  with_check text
);
GRANT ALL ON public.mk9_rls_policy_backup TO service_role;
ALTER TABLE public.mk9_rls_policy_backup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mk9_rls_policy_backup_admin ON public.mk9_rls_policy_backup;
CREATE POLICY mk9_rls_policy_backup_admin ON public.mk9_rls_policy_backup
  FOR SELECT TO authenticated
  USING (public.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role));

INSERT INTO public.mk9_rls_policy_backup
  (schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename LIKE 'mk9\_%' ESCAPE '\';

-- ============================================================
-- 2. Funções auxiliares
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_mk9_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role);
$$;

CREATE OR REPLACE FUNCTION public.user_has_mk9_scope(_scope_type text, _scope_value text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mk9_user_scopes
     WHERE user_id = auth.uid()
       AND scope_type = _scope_type
       AND scope_value = _scope_value
  );
$$;

-- Indústria visível ao usuário atual
CREATE OR REPLACE FUNCTION public.mk9_visible_industry(_industry_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _industry_id IS NULL
    OR public.is_mk9_admin()
    OR public.has_mk9_role(auth.uid(), 'AUDITOR'::mk9_role)
    OR (
      public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role)
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
      public.has_mk9_role(auth.uid(), 'CLIENTE'::mk9_role)
      AND EXISTS (SELECT 1 FROM public.mk9_user_scopes s
                   WHERE s.user_id = auth.uid()
                     AND s.scope_type = 'INDUSTRY'
                     AND s.scope_value = _industry_id::text)
    );
$$;

-- Loja visível ao usuário atual (usada para filtragem por UF em SUPERVISOR)
CREATE OR REPLACE FUNCTION public.mk9_visible_store(_store_uf text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_mk9_admin()
    OR public.has_mk9_role(auth.uid(), 'AUDITOR'::mk9_role)
    OR public.has_mk9_role(auth.uid(), 'CLIENTE'::mk9_role)
    OR (
      public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role)
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
$$;

-- ============================================================
-- 3. Substituir policies permissivas (SELECT + write ADMIN)
-- ============================================================

-- mk9_industries
DROP POLICY IF EXISTS mk9_industries_auth ON public.mk9_industries;
CREATE POLICY mk9_industries_select ON public.mk9_industries
  FOR SELECT TO authenticated
  USING (public.mk9_visible_industry(id));
CREATE POLICY mk9_industries_admin_write ON public.mk9_industries
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());

-- mk9_stores
DROP POLICY IF EXISTS mk9_stores_auth ON public.mk9_stores;
CREATE POLICY mk9_stores_select ON public.mk9_stores
  FOR SELECT TO authenticated
  USING (public.mk9_visible_store(uf));
CREATE POLICY mk9_stores_admin_write ON public.mk9_stores
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());

-- mk9_promoters (sem escopo geográfico próprio — leitura para ADMIN/AUDITOR/SUPERVISOR)
DROP POLICY IF EXISTS mk9_promoters_auth ON public.mk9_promoters;
CREATE POLICY mk9_promoters_select ON public.mk9_promoters
  FOR SELECT TO authenticated
  USING (
    public.is_mk9_admin()
    OR public.has_mk9_role(auth.uid(), 'AUDITOR'::mk9_role)
    OR public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role)
  );
CREATE POLICY mk9_promoters_admin_write ON public.mk9_promoters
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());

-- mk9_planned_routes
DROP POLICY IF EXISTS mk9_planned_routes_auth ON public.mk9_planned_routes;
CREATE POLICY mk9_planned_routes_select ON public.mk9_planned_routes
  FOR SELECT TO authenticated
  USING (public.mk9_visible_industry(industry_id));
CREATE POLICY mk9_planned_routes_admin_write ON public.mk9_planned_routes
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());

-- mk9_planned_visits
DROP POLICY IF EXISTS mk9_planned_visits_auth ON public.mk9_planned_visits;
CREATE POLICY mk9_planned_visits_select ON public.mk9_planned_visits
  FOR SELECT TO authenticated
  USING (public.mk9_visible_industry(industry_id));
CREATE POLICY mk9_planned_visits_admin_write ON public.mk9_planned_visits
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());

-- mk9_actual_visits
DROP POLICY IF EXISTS mk9_actual_visits_auth ON public.mk9_actual_visits;
CREATE POLICY mk9_actual_visits_select ON public.mk9_actual_visits
  FOR SELECT TO authenticated
  USING (public.mk9_visible_industry(industry_id));
CREATE POLICY mk9_actual_visits_admin_write ON public.mk9_actual_visits
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());

-- mk9_visit_reconciliations
DROP POLICY IF EXISTS mk9_visit_reconciliations_auth ON public.mk9_visit_reconciliations;
CREATE POLICY mk9_visit_reconciliations_select ON public.mk9_visit_reconciliations
  FOR SELECT TO authenticated
  USING (public.mk9_visible_industry(industry_id));
CREATE POLICY mk9_visit_reconciliations_admin_write ON public.mk9_visit_reconciliations
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());

-- mk9_industry_store_frequency
DROP POLICY IF EXISTS mk9_isf_auth ON public.mk9_industry_store_frequency;
CREATE POLICY mk9_isf_select ON public.mk9_industry_store_frequency
  FOR SELECT TO authenticated
  USING (public.mk9_visible_industry(industry_id));
CREATE POLICY mk9_isf_admin_write ON public.mk9_industry_store_frequency
  FOR ALL TO authenticated
  USING (public.is_mk9_admin())
  WITH CHECK (public.is_mk9_admin());