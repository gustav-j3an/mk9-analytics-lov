-- 1. Auditar visitas duplicadas REAIS (id diferente, mesma loja/data) para COPRA Julho/2026
SELECT 
    v1.id as visit1_id, 
    v2.id as visit2_id, 
    v1.store_id, 
    v1.scheduled_date, 
    v1.source_import_id as import1, 
    v2.source_import_id as import2
FROM public.mk9_actual_visits v1
JOIN public.mk9_actual_visits v2 ON v1.store_id = v2.store_id 
    AND v1.scheduled_date = v2.scheduled_date 
    AND v1.id < v2.id
WHERE v1.industry_id = (SELECT id FROM mk9_industries WHERE name = 'COPRA')
  AND v1.scheduled_date >= '2026-07-01' AND v1.scheduled_date <= '2026-07-31';

-- 2. Limpeza estrutural: desativar imports obsoletos e ativar o correto para COPRA Julho
UPDATE public.mk9_checklist_imports 
SET is_operational_current = (id = '902ae653-8691-4d42-936f-5d33436f4243')
WHERE industry_id = (SELECT id FROM mk9_industries WHERE name = 'COPRA')
  AND operation_month = 7 
  AND operation_year = 2026;

-- 3. Limpeza de visitas órfãs (sem import ou com import errado)
DELETE FROM public.mk9_actual_visits
WHERE industry_id = (SELECT id FROM mk9_industries WHERE name = 'COPRA')
  AND scheduled_date >= '2026-07-01' AND scheduled_date <= '2026-07-31'
  AND (source_import_id IS NULL OR source_import_id != '902ae653-8691-4d42-936f-5d33436f4243');

-- 4. Garantir que o snapshot do import 902ae653... tenha as frequências corretas
UPDATE public.mk9_checklist_import_store_snapshots
SET monthly_frequency = 12, weekly_frequency = 3
WHERE import_id = '902ae653-8691-4d42-936f-5d33436f4243'
  AND source_store_name NOT LIKE '%SAMAMBAIA NORTE%';

UPDATE public.mk9_checklist_import_store_snapshots
SET monthly_frequency = 8, weekly_frequency = 2
WHERE import_id = '902ae653-8691-4d42-936f-5d33436f4243'
  AND source_store_name LIKE '%SAMAMBAIA NORTE%';