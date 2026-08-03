-- Adiciona campos para controle de substituição de checklists
ALTER TABLE public.mk9_checklist_imports 
ADD COLUMN IF NOT EXISTS is_operational_current boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.mk9_checklist_imports(id),
ADD COLUMN IF NOT EXISTS replaces_import_id uuid REFERENCES public.mk9_checklist_imports(id),
ADD COLUMN IF NOT EXISTS replacement_reason text,
ADD COLUMN IF NOT EXISTS import_mode text DEFAULT 'FULL_REPLACEMENT';

-- Índice parcial para garantir apenas uma importação vigente por indústria e competência
CREATE UNIQUE INDEX IF NOT EXISTS idx_mk9_checklist_imports_operational_current 
ON public.mk9_checklist_imports (industry_id, operation_month, operation_year) 
WHERE (is_operational_current = true AND status = 'done');

-- Garante permissões
GRANT SELECT, UPDATE ON public.mk9_checklist_imports TO authenticated;
GRANT ALL ON public.mk9_checklist_imports TO service_role;
