
-- 1. Extensão de mk9_profiles
ALTER TABLE public.mk9_profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 2. Policies de ADMIN sobre profiles e roles (usa has_mk9_role já existente)
DROP POLICY IF EXISTS mk9_profiles_admin_all ON public.mk9_profiles;
CREATE POLICY mk9_profiles_admin_all ON public.mk9_profiles
  FOR ALL TO authenticated
  USING (public.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role))
  WITH CHECK (public.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role));

DROP POLICY IF EXISTS mk9_user_roles_admin_all ON public.mk9_user_roles;
CREATE POLICY mk9_user_roles_admin_all ON public.mk9_user_roles
  FOR ALL TO authenticated
  USING (public.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role))
  WITH CHECK (public.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role));

-- 3. mk9_user_scopes
CREATE TABLE IF NOT EXISTS public.mk9_user_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope_type, scope_value)
);

GRANT SELECT ON public.mk9_user_scopes TO authenticated;
GRANT ALL ON public.mk9_user_scopes TO service_role;
ALTER TABLE public.mk9_user_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mk9_user_scopes_self_select ON public.mk9_user_scopes;
CREATE POLICY mk9_user_scopes_self_select ON public.mk9_user_scopes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role));

DROP POLICY IF EXISTS mk9_user_scopes_admin_all ON public.mk9_user_scopes;
CREATE POLICY mk9_user_scopes_admin_all ON public.mk9_user_scopes
  FOR ALL TO authenticated
  USING (public.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role))
  WITH CHECK (public.has_mk9_role(auth.uid(), 'ADMIN'::mk9_role));

CREATE INDEX IF NOT EXISTS idx_mk9_user_scopes_user ON public.mk9_user_scopes(user_id);
CREATE INDEX IF NOT EXISTS idx_mk9_user_scopes_type ON public.mk9_user_scopes(scope_type, scope_value);
