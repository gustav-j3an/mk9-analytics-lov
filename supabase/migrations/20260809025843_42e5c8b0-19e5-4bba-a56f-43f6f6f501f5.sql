DELETE FROM public.mk9_actual_visits 
WHERE industry_id = '57376220-55fd-4419-84d0-dc957f3e8114' 
  AND source_import_id IS NULL 
  AND scheduled_date >= '2026-07-01' AND scheduled_date <= '2026-07-31';

DELETE FROM public.mk9_visit_reconciliations
WHERE industry_id = '57376220-55fd-4419-84d0-dc957f3e8114'
  AND operation_month = 7
  AND operation_year = 2026;