-- Adiciona suporte a arquivamento para Promotores e Lojas
ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS archive_reason TEXT DEFAULT NULL;

ALTER TABLE public.mk9_stores ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.mk9_stores ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE public.mk9_stores ADD COLUMN IF NOT EXISTS archive_reason TEXT DEFAULT NULL;

-- Garante que o ADMIN tenha acesso
GRANT UPDATE, SELECT ON public.mk9_promoters TO authenticated;
GRANT UPDATE, SELECT ON public.mk9_stores TO authenticated;
