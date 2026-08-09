
-- 1. Garantir que o status está correto para a promoção
UPDATE public.mk9_checklist_imports SET status = 'committing' WHERE id = '6ff3ba73-8572-4240-939e-0b0cbafa7353';

-- 2. Identificar a indústria e competência
-- Fruta Polpa (357a7f7c-5a7a-4c28-98e9-d75e0c5f2128), Julho 2026

-- 3. Desativar versões anteriores
UPDATE public.mk9_checklist_imports 
SET is_operational_current = false, superseded_at = now(), superseded_by = '6ff3ba73-8572-4240-939e-0b0cbafa7353'
WHERE industry_id = (SELECT industry_id FROM public.mk9_checklist_imports WHERE id = '6ff3ba73-8572-4240-939e-0b0cbafa7353')
  AND operation_month = 7
  AND operation_year = 2026
  AND id != '6ff3ba73-8572-4240-939e-0b0cbafa7353'
  AND is_operational_current = true;

-- 4. Ativar a nova versão
UPDATE public.mk9_checklist_imports 
SET is_operational_current = true, status = 'COMPLETED_WITH_ALERTS', finished_at = now()
WHERE id = '6ff3ba73-8572-4240-939e-0b0cbafa7353';

-- 5. Vincular frequências (idempotente)
UPDATE public.mk9_industry_store_frequency_versions
SET source_import_id = '6ff3ba73-8572-4240-939e-0b0cbafa7353'
WHERE industry_id = (SELECT industry_id FROM public.mk9_checklist_imports WHERE id = '6ff3ba73-8572-4240-939e-0b0cbafa7353')
  AND valid_from = '2026-07-01'
  AND archived_at IS NULL;
