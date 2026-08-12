-- 1. Regra de consistência: Se exige controle de visita, exige checklist.
UPDATE public.mk9_industries 
SET requires_checklist = true,
    checklist_enabled_at = COALESCE(checklist_enabled_at, now())
WHERE control_mode = 'VISIT_CONTROLLED' 
  AND requires_checklist = false;

-- 2. Correção da flag para indústrias específicas identificadas
UPDATE public.mk9_industries 
SET requires_checklist = true,
    checklist_enabled_at = COALESCE(checklist_enabled_at, now())
WHERE name IN ('CO LATICÍNIOS', 'PACHA ALIMENTOS', 'PACHÁ ALIMENTOS')
  AND requires_checklist = false;

-- 3. Trigger para manter a consistência em novos inserts/updates
CREATE OR REPLACE FUNCTION public.mk9_sync_checklist_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.control_mode = 'VISIT_CONTROLLED' THEN
    NEW.requires_checklist := true;
    IF NEW.checklist_enabled_at IS NULL THEN
      NEW.checklist_enabled_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_mk9_sync_checklist_flag ON public.mk9_industries;
CREATE TRIGGER trg_mk9_sync_checklist_flag
BEFORE INSERT OR UPDATE ON public.mk9_industries
FOR EACH ROW EXECUTE FUNCTION public.mk9_sync_checklist_flag();
