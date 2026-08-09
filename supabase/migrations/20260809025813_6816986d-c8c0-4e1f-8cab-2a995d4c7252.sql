UPDATE public.mk9_checklist_imports 
SET is_operational_current = true 
WHERE id = '77e0512e-6b81-4fc2-b408-475d2864967d';

UPDATE public.mk9_checklist_imports 
SET is_operational_current = false 
WHERE industry_id = '57376220-55fd-4419-84d0-dc957f3e8114' 
  AND operation_month = 7 
  AND operation_year = 2026 
  AND id != '77e0512e-6b81-4fc2-b408-475d2864967d';

UPDATE public.mk9_industry_store_frequency_versions
SET source_import_id = '77e0512e-6b81-4fc2-b408-475d2864967d'
WHERE industry_id = '57376220-55fd-4419-84d0-dc957f3e8114'
  AND valid_from = '2026-07-01';