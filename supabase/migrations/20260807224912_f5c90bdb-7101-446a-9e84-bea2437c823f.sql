ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS employee_number text;
CREATE UNIQUE INDEX IF NOT EXISTS mk9_promoters_employee_number_unique_idx ON public.mk9_promoters (employee_number) WHERE employee_number IS NOT NULL;
COMMENT ON COLUMN public.mk9_promoters.employee_number IS 'Matrícula interna do colaborador (identificador do RH/ERP).';