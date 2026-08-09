-- HOTFIX: Sincronização do enum mk9_import_status com o código
-- Adiciona o valor 'COMPLETED_WITH_ALERTS' para suportar importações com avisos não bloqueantes.

ALTER TYPE public.mk9_import_status ADD VALUE IF NOT EXISTS 'COMPLETED_WITH_ALERTS';
