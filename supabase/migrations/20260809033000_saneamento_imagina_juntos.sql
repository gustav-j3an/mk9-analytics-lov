-- Saneamento IMAGINA JUNTOS Julho 2026
-- 1. Ativar importação correta
UPDATE public.mk9_checklist_imports 
SET is_operational_current = true, 
    status = 'done',
    updated_at = now()
WHERE id = '225097b8-6c9c-424d-b354-7cfc041f570b';

-- 2. Desativar outras importações do mesmo período
UPDATE public.mk9_checklist_imports
SET is_operational_current = false,
    updated_at = now()
WHERE industry_id = '6760a0c9-7582-4f14-aa00-3d760a6d6f78'
  AND operation_month = 7
  AND operation_year = 2026
  AND id != '225097b8-6c9c-424d-b354-7cfc041f570b';

-- 3. Remover visitas extras identificadas (órfãs/manuais que não batem com a planilha)
DELETE FROM public.mk9_actual_visits
WHERE id IN (
  'ffd83a80-b2e8-4ed5-a580-9d8595412aa3', -- ATACADÃO - GOIÁS NORTE 64
  '25d22791-ae70-4d3b-b319-1156e9795304'  -- ATACADÃO - SIA
);

-- 4. Garantir frequências versionadas a partir do snapshot (Blindagem)
INSERT INTO public.mk9_industry_store_frequency_versions (
  industry_id, store_id, weekly_frequency, monthly_frequency, 
  valid_from, valid_until, source_type, source_import_id
)
SELECT 
  industry_id, store_id, weekly_frequency, monthly_frequency, 
  '2026-06-23'::date, '2026-07-22'::date, 'IMPORT', import_id
FROM public.mk9_checklist_import_store_snapshots
WHERE import_id = '225097b8-6c9c-424d-b354-7cfc041f570b'
ON CONFLICT (industry_id, store_id, daterange(valid_from, COALESCE(valid_until + 1, 'infinity'::date), '[)')) 
WHERE archived_at IS NULL
DO UPDATE SET 
  weekly_frequency = EXCLUDED.weekly_frequency,
  monthly_frequency = EXCLUDED.monthly_frequency,
  source_import_id = EXCLUDED.source_import_id,
  updated_at = now();
