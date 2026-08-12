-- Criar a tabela de evidências novamente sem a falha do has_role (usaremos subquery direta para agora se necessário, ou verificaremos a existência da função)
-- Primeiro, vamos garantir que a função has_role existe conforme o padrão do projeto (geralmente ela existe se foi criada em missões anteriores)
-- Se falhou, vamos criar/recriar a função para garantir consistência.

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'PROMOTOR');

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role app_role not null,
    unique (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Agora a tabela de evidências
CREATE TABLE public.mk9_visit_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID NOT NULL REFERENCES public.mk9_promoters(id) ON DELETE CASCADE,
    planned_route_id UUID NOT NULL REFERENCES public.mk9_planned_routes(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.mk9_stores(id) ON DELETE CASCADE,
    industry_id UUID NOT NULL REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
    photo_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    delete_after TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON public.mk9_visit_evidence TO authenticated;
GRANT ALL ON public.mk9_visit_evidence TO service_role;

ALTER TABLE public.mk9_visit_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promoters can view own evidence"
ON public.mk9_visit_evidence
FOR SELECT
TO authenticated
USING (
    promoter_id IN (
        SELECT id FROM public.mk9_promoters WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Promoters can insert own evidence"
ON public.mk9_visit_evidence
FOR INSERT
TO authenticated
WITH CHECK (
    promoter_id IN (
        SELECT id FROM public.mk9_promoters WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Promoters can update pending own evidence"
ON public.mk9_visit_evidence
FOR UPDATE
TO authenticated
USING (
    promoter_id IN (
        SELECT id FROM public.mk9_promoters WHERE user_id = auth.uid()
    ) AND status = 'PENDING'
)
WITH CHECK (
    promoter_id IN (
        SELECT id FROM public.mk9_promoters WHERE user_id = auth.uid()
    ) AND status = 'PENDING'
);

CREATE POLICY "Admins and Supervisors can view all evidence"
ON public.mk9_visit_evidence
FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
);
