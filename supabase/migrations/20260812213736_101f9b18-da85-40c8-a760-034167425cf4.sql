
-- 1. Criar enum se necessário (verificamos que só tem CHECKLIST)
ALTER TYPE public.mk9_actual_visit_origin ADD VALUE IF NOT EXISTS 'PORTAL';

-- 2. Adicionar campo evidence_id em mk9_actual_visits
ALTER TABLE public.mk9_actual_visits 
ADD COLUMN IF NOT EXISTS evidence_id uuid REFERENCES public.mk9_visit_evidence(id),
ADD CONSTRAINT mk9_actual_visits_evidence_id_unique UNIQUE (evidence_id);

-- 3. Adicionar campo evidence_id em mk9_planned_visits (Opcional mas recomendado para rastreabilidade de roteiro vs execução)
-- Por enquanto manteremos apenas na actual_visits conforme pedido.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_actual_visits TO authenticated;
GRANT ALL ON public.mk9_actual_visits TO service_role;
