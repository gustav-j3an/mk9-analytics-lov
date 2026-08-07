ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS uf text;
COMMENT ON COLUMN public.mk9_promoters.uf IS 'Estado (UF) do promotor';

GRANT UPDATE (uf) ON public.mk9_promoters TO authenticated;
GRANT ALL ON public.mk9_promoters TO service_role;
