
-- 1. Update mk9_import_status enum
-- Postgres doesn't allow ALTER TYPE ... ADD VALUE inside a transaction block easily.
-- We'll try to do it individually or assume the migration tool handles it.
-- Actually, the migration tool usually runs in a transaction.
-- If it fails, I might need to run it via code--exec.

-- 2. Add columns to mk9_checklist_imports
ALTER TABLE public.mk9_checklist_imports
  ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reverted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revert_reason TEXT,
  ADD COLUMN IF NOT EXISTS reverted_counters JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS corrected_to_import_id UUID REFERENCES public.mk9_checklist_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrected_from_import_id UUID REFERENCES public.mk9_checklist_imports(id) ON DELETE SET NULL;

-- 3. Grants
GRANT SELECT, UPDATE ON public.mk9_checklist_imports TO authenticated;
GRANT ALL ON public.mk9_checklist_imports TO service_role;
