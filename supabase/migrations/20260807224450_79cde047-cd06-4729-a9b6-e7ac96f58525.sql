ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.mk9_profiles(id);
ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS inactive_from date;

GRANT UPDATE (supervisor_id, inactive_from) ON public.mk9_promoters TO authenticated;
GRANT ALL ON public.mk9_promoters TO service_role;
