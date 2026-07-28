ALTER TABLE public.mk9_checklist_imports
  ADD COLUMN IF NOT EXISTS validation_status text,
  ADD COLUMN IF NOT EXISTS validation_details jsonb,
  ADD COLUMN IF NOT EXISTS validated_at timestamp with time zone;