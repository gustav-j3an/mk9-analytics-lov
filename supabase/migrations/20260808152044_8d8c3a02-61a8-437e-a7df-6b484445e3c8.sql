ALTER TABLE public.mk9_checklist_imports ADD COLUMN IF NOT EXISTS is_operational_current boolean DEFAULT false;

UPDATE public.mk9_checklist_imports 
SET is_operational_current = true 
WHERE id = '9e868554-a9f3-4a25-acc2-51e673648512';