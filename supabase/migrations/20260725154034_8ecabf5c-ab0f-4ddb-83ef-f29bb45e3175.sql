
ALTER TABLE public.mk9_stores
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS is_incomplete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by_checklist_import_id uuid REFERENCES public.mk9_checklist_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;
