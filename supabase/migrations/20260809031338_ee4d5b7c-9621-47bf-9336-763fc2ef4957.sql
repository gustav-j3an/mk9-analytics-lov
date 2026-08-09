
UPDATE mk9_checklist_imports
SET is_operational_current = true
WHERE id = (
  SELECT id FROM mk9_checklist_imports
  WHERE industry_id = (SELECT id FROM mk9_industries WHERE name ILIKE '%EMBAVI%' LIMIT 1)
    AND operation_month = 7
    AND operation_year = 2026
    AND status IN ('done', 'INCONSISTENT', 'COMPLETED_WITH_ALERTS')
  ORDER BY finished_at DESC
  LIMIT 1
);

UPDATE mk9_checklist_imports
SET is_operational_current = false
WHERE industry_id = (SELECT id FROM mk9_industries WHERE name ILIKE '%EMBAVI%' LIMIT 1)
  AND operation_month = 7
  AND operation_year = 2026
  AND id != (
    SELECT id FROM mk9_checklist_imports
    WHERE industry_id = (SELECT id FROM mk9_industries WHERE name ILIKE '%EMBAVI%' LIMIT 1)
      AND operation_month = 7
      AND operation_year = 2026
      AND status IN ('done', 'INCONSISTENT', 'COMPLETED_WITH_ALERTS')
    ORDER BY finished_at DESC
    LIMIT 1
  );

UPDATE mk9_industry_store_frequency_versions
SET source_import_id = (
  SELECT id FROM mk9_checklist_imports
  WHERE industry_id = (SELECT id FROM mk9_industries WHERE name ILIKE '%EMBAVI%' LIMIT 1)
    AND operation_month = 7
    AND operation_year = 2026
    AND status IN ('done', 'INCONSISTENT', 'COMPLETED_WITH_ALERTS')
  ORDER BY finished_at DESC
  LIMIT 1
)
WHERE industry_id = (SELECT id FROM mk9_industries WHERE name ILIKE '%EMBAVI%' LIMIT 1)
  AND valid_from = '2026-07-01'
  AND archived_at IS NULL;
