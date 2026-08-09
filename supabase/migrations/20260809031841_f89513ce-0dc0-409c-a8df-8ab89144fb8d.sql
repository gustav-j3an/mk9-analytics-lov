
-- 1. Promover a importação para operacional
UPDATE mk9_checklist_imports
SET 
  is_operational_current = true,
  status = 'COMPLETED_WITH_ALERTS',
  finished_at = now()
WHERE id = '6ff3ba73-8572-4240-939e-0b0cbafa7353';

-- 2. Desativar outras importações da mesma competência para FRUTA POLPA
UPDATE mk9_checklist_imports
SET is_operational_current = false
WHERE industry_id = (SELECT industry_id FROM mk9_checklist_imports WHERE id = '6ff3ba73-8572-4240-939e-0b0cbafa7353')
  AND operation_month = 7
  AND operation_year = 2026
  AND id != '6ff3ba73-8572-4240-939e-0b0cbafa7353';

-- 3. Vincular frequências versionadas à importação correta
UPDATE mk9_industry_store_frequency_versions
SET source_import_id = '6ff3ba73-8572-4240-939e-0b0cbafa7353'
WHERE industry_id = (SELECT industry_id FROM mk9_checklist_imports WHERE id = '6ff3ba73-8572-4240-939e-0b0cbafa7353')
  AND valid_from = '2026-07-01'
  AND archived_at IS NULL;
