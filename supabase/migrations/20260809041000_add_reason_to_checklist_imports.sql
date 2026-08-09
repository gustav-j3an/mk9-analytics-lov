-- v1.3.15 - Adiciona coluna reason à tabela mk9_checklist_imports para auditoria de status
ALTER TABLE public.mk9_checklist_imports ADD COLUMN IF NOT EXISTS reason text;

-- Garante que as permissões estejam corretas
GRANT SELECT, UPDATE ON public.mk9_checklist_imports TO authenticated;
GRANT ALL ON public.mk9_checklist_imports TO service_role;

COMMENT ON COLUMN public.mk9_checklist_imports.reason IS 'Motivo da transição de status (ex: preview_abandoned, duplicate_unchanged, finalize_commit)';
