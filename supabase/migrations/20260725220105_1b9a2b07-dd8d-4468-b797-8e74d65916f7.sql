
-- 1. ENUM de roles
CREATE TYPE public.mk9_role AS ENUM ('ADMIN', 'SUPERVISOR', 'PROMOTOR', 'CLIENTE', 'AUDITOR');

-- 2. Tabela de perfis
CREATE TABLE public.mk9_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_profiles TO authenticated;
GRANT ALL ON public.mk9_profiles TO service_role;

ALTER TABLE public.mk9_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mk9_profiles_self_select" ON public.mk9_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "mk9_profiles_self_update" ON public.mk9_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER mk9_profiles_touch_updated_at
  BEFORE UPDATE ON public.mk9_profiles
  FOR EACH ROW EXECUTE FUNCTION public.mk9_touch_updated_at();

CREATE INDEX mk9_profiles_user_id_idx ON public.mk9_profiles(user_id);

-- 3. Tabela de user_roles
CREATE TABLE public.mk9_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.mk9_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.mk9_user_roles TO authenticated;
GRANT ALL ON public.mk9_user_roles TO service_role;

ALTER TABLE public.mk9_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mk9_user_roles_self_select" ON public.mk9_user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX mk9_user_roles_user_id_idx ON public.mk9_user_roles(user_id);
CREATE INDEX mk9_user_roles_role_idx ON public.mk9_user_roles(role);

-- 4. Função de verificação de role (SECURITY DEFINER para evitar recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_mk9_role(user_uuid uuid, required_role public.mk9_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mk9_user_roles
    WHERE user_id = user_uuid AND role = required_role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_mk9_role(uuid, public.mk9_role) TO authenticated, anon, service_role;

-- 5. Trigger de novo usuário: cria perfil automaticamente
CREATE OR REPLACE FUNCTION public.mk9_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mk9_profiles (user_id, email, name, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_mk9
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.mk9_handle_new_user();

-- 6. Backfill de perfis para usuários já existentes
INSERT INTO public.mk9_profiles (user_id, email, name, active)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name'), true
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;
