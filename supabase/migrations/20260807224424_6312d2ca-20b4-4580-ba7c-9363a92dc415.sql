ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Atualiza is_active baseado em archived_at para dados existentes
UPDATE public.mk9_promoters SET is_active = (archived_at IS NULL);

GRANT UPDATE (is_active, updated_by) ON public.mk9_promoters TO authenticated;
GRANT ALL ON public.mk9_promoters TO service_role;
