ALTER TABLE public.mk9_checklist_imports ADD COLUMN IF NOT EXISTS reason text;
GRANT SELECT, UPDATE ON public.mk9_checklist_imports TO authenticated;
GRANT ALL ON public.mk9_checklist_imports TO service_role;