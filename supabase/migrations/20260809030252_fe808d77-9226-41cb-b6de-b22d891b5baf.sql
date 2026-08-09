-- Ativação estrutural COPRA Julho/2026
UPDATE public.mk9_checklist_imports 
SET is_operational_current = true 
WHERE id = '902ae653-8691-4d42-936f-5d33436f4243';

UPDATE public.mk9_checklist_imports 
SET is_operational_current = false 
WHERE industry_id = (SELECT id FROM mk9_industries WHERE name = 'COPRA')
  AND operation_month = 7 
  AND operation_year = 2026 
  AND id != '902ae653-8691-4d42-936f-5d33436f4243';

-- Sincronização de frequências para o import vigente
UPDATE public.mk9_industry_store_frequency_versions
SET source_import_id = '902ae653-8691-4d42-936f-5d33436f4243'
WHERE industry_id = (SELECT id FROM mk9_industries WHERE name = 'COPRA')
  AND valid_from = '2026-07-01'
  AND archived_at IS NULL;

-- Limpeza de visitas órfãs/antigas da COPRA Julho
DELETE FROM public.mk9_actual_visits
WHERE industry_id = (SELECT id FROM mk9_industries WHERE name = 'COPRA')
  AND scheduled_date >= '2026-07-01' AND scheduled_date <= '2026-07-31'
  AND (source_import_id IS NULL OR source_import_id != '902ae653-8691-4d42-936f-5d33436f4243');

-- Forçar re-reconciliação
DELETE FROM public.mk9_visit_reconciliations
WHERE industry_id = (SELECT id FROM mk9_industries WHERE name = 'COPRA')
  AND operation_month = 7
  AND operation_year = 2026;