-- 1. Criar o Enum para o modo de controle
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mk9_industry_control_mode') THEN
    CREATE TYPE public.mk9_industry_control_mode AS ENUM ('VISIT_CONTROLLED', 'FIXED_OPERATION');
  END IF;
END $$;

-- 2. Adicionar a coluna à tabela mk9_industries
ALTER TABLE public.mk9_industries 
ADD COLUMN IF NOT EXISTS control_mode public.mk9_industry_control_mode DEFAULT 'VISIT_CONTROLLED';

-- 3. Criar função auxiliar no schema privado
CREATE OR REPLACE FUNCTION mk9_private.is_industry_visit_controlled(p_industry_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mk9_industries
    WHERE id = p_industry_id 
    AND control_mode = 'VISIT_CONTROLLED'
    AND archived_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. Permissões
REVOKE EXECUTE ON FUNCTION mk9_private.is_industry_visit_controlled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mk9_private.is_industry_visit_controlled(uuid) TO authenticated, service_role;
GRANT SELECT, UPDATE ON public.mk9_industries TO authenticated;
GRANT ALL ON public.mk9_industries TO service_role;

COMMENT ON COLUMN public.mk9_industries.control_mode IS 'Define se a indústria participa do Analytics/Checklist (VISIT_CONTROLLED) ou se é apenas para roteiro/faturamento fixo (FIXED_OPERATION).';