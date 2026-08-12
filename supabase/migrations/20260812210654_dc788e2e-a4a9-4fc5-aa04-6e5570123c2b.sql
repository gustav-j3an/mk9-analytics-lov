-- 1. Vincular Promotores a usuários do Supabase
ALTER TABLE public.mk9_promoters ADD COLUMN user_id UUID UNIQUE;
ALTER TABLE public.mk9_promoters ADD CONSTRAINT mk9_promoters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Identificar promotor responsável pelas visitas reais
ALTER TABLE public.mk9_actual_visits ADD COLUMN promoter_id UUID;
ALTER TABLE public.mk9_actual_visits ADD CONSTRAINT mk9_actual_visits_promoter_id_fkey FOREIGN KEY (promoter_id) REFERENCES public.mk9_promoters(id) ON DELETE SET NULL;

-- 3. Comentários para documentação de schema
COMMENT ON COLUMN public.mk9_promoters.user_id IS 'ID do usuário autenticado (auth.users) vinculado a este promotor.';
COMMENT ON COLUMN public.mk9_actual_visits.promoter_id IS 'ID do promotor que realizou a visita (preenchido via Portal do Promotor).';

-- 4. RLS: Permitir que promotores vejam seus próprios dados
ALTER TABLE public.mk9_promoters ENABLE ROW LEVEL SECURITY;

-- Remove policies existentes se houver
DO $$ BEGIN
    DROP POLICY IF EXISTS "Promotores podem ver seu próprio cadastro" ON public.mk9_promoters;
    DROP POLICY IF EXISTS "Promotores podem ver seus próprios roteiros" ON public.mk9_planned_routes;
EXCEPTION WHEN undefined_object THEN
    NULL;
END $$;

CREATE POLICY "Promotores podem ver seu próprio cadastro"
ON public.mk9_promoters
FOR SELECT
TO authenticated
USING (
  (EXISTS (SELECT 1 FROM public.mk9_user_roles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'SUPERVISOR'))) OR 
  (user_id = auth.uid())
);

ALTER TABLE public.mk9_planned_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promotores podem ver seus próprios roteiros"
ON public.mk9_planned_routes
FOR SELECT
TO authenticated
USING (
  (EXISTS (SELECT 1 FROM public.mk9_user_roles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'SUPERVISOR'))) OR 
  (promoter_id IN (SELECT id FROM public.mk9_promoters WHERE user_id = auth.uid()))
);

-- Garantir privilégios
GRANT SELECT ON public.mk9_promoters TO authenticated;
GRANT SELECT ON public.mk9_planned_routes TO authenticated;
