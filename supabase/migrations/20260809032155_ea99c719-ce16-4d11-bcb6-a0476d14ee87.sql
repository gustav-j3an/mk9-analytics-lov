-- 1. Adicionar colunas de versionamento ausentes
ALTER TABLE public.mk9_checklist_imports 
ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.mk9_checklist_imports(id),
ADD COLUMN IF NOT EXISTS replaces_import_id uuid REFERENCES public.mk9_checklist_imports(id),
ADD COLUMN IF NOT EXISTS replacement_reason text,
ADD COLUMN IF NOT EXISTS import_mode text DEFAULT 'FULL_REPLACEMENT';

-- 2. Garantir que is_operational_current existe e tem o default correto
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mk9_checklist_imports' AND column_name='is_operational_current') THEN
        ALTER TABLE public.mk9_checklist_imports ADD COLUMN is_operational_current boolean DEFAULT false;
    END IF;
END $$;

-- 3. Atualizar o enum de status para incluir novos estados da v1.3.9
-- PostgreSQL não suporta IF NOT EXISTS em ALTER TYPE ADD VALUE, usamos um bloco DO para segurança
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid WHERE pg_type.typname = 'mk9_import_status' AND pg_enum.enumlabel = 'INCONSISTENT') THEN
        ALTER TYPE public.mk9_import_status ADD VALUE 'INCONSISTENT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid WHERE pg_type.typname = 'mk9_import_status' AND pg_enum.enumlabel = 'COMPLETED_WITH_ALERTS') THEN
        ALTER TYPE public.mk9_import_status ADD VALUE 'COMPLETED_WITH_ALERTS';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid WHERE pg_type.typname = 'mk9_import_status' AND pg_enum.enumlabel = 'committing') THEN
        ALTER TYPE public.mk9_import_status ADD VALUE 'committing';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. Recriar índice de unicidade operacional (idempotente)
DROP INDEX IF EXISTS public.idx_mk9_checklist_imports_operational_current;
CREATE UNIQUE INDEX idx_mk9_checklist_imports_operational_current 
ON public.mk9_checklist_imports (industry_id, operation_month, operation_year) 
WHERE (is_operational_current = true AND status IN ('done', 'INCONSISTENT', 'COMPLETED_WITH_ALERTS'));

-- 5. Garantir permissões nas novas colunas
GRANT SELECT, UPDATE ON public.mk9_checklist_imports TO authenticated;
GRANT ALL ON public.mk9_checklist_imports TO service_role;
