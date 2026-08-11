-- Adicionar status VACATION ao enum presence_status
-- O enum e a tabela foram confirmados na inspeção anterior
ALTER TYPE public.presence_status ADD VALUE IF NOT EXISTS 'VACATION';
