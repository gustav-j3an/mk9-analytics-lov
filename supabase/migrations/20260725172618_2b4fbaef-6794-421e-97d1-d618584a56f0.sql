
-- Limpa órfãos que impediriam a criação da FK
DELETE FROM public.mk9_industry_store_frequency f
WHERE NOT EXISTS (SELECT 1 FROM public.mk9_stores s WHERE s.id = f.store_id)
   OR NOT EXISTS (SELECT 1 FROM public.mk9_industries i WHERE i.id = f.industry_id);

ALTER TABLE public.mk9_industry_store_frequency
  ADD CONSTRAINT mk9_industry_store_frequency_industry_id_fkey
    FOREIGN KEY (industry_id) REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
  ADD CONSTRAINT mk9_industry_store_frequency_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.mk9_stores(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
