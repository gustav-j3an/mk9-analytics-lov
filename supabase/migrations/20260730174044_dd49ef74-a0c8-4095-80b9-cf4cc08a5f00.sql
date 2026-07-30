-- 1) Campos
ALTER TABLE public.mk9_industries
  ADD COLUMN IF NOT EXISTS requires_checklist boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_enabled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS checklist_enabled_by uuid NULL;

COMMENT ON COLUMN public.mk9_industries.requires_checklist IS
  'Indica se a industria participa do fluxo operacional de checklist. Nao significa industria inativa.';

CREATE INDEX IF NOT EXISTS mk9_industries_requires_checklist_idx
  ON public.mk9_industries (requires_checklist);

-- 2) Guarda: o campo so muda dentro da acao administrativa dedicada.
CREATE OR REPLACE FUNCTION public.mk9_guard_requires_checklist()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.requires_checklist IS DISTINCT FROM OLD.requires_checklist
     AND coalesce(current_setting('mk9.allow_checklist_flag_change', true), '') <> '1' THEN
    NEW.requires_checklist := OLD.requires_checklist;
    NEW.checklist_enabled_at := OLD.checklist_enabled_at;
    NEW.checklist_enabled_by := OLD.checklist_enabled_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mk9_industries_guard_requires_checklist ON public.mk9_industries;
CREATE TRIGGER mk9_industries_guard_requires_checklist
  BEFORE UPDATE ON public.mk9_industries
  FOR EACH ROW EXECUTE FUNCTION public.mk9_guard_requires_checklist();

-- 3) Backfill idempotente (somente a lista aprovada encontrada no cadastro).
DO $$
DECLARE
  v_names text[] := ARRAY[
    'ao quadrado','cicopal go','coopatos','copra','embavi','fruta polpa',
    'king','mendez','missiato','rb alimentos','sao braz'
  ];
  v_updated int;
BEGIN
  PERFORM set_config('mk9.allow_checklist_flag_change', '1', true);

  UPDATE public.mk9_industries
     SET requires_checklist = true,
         checklist_enabled_at = coalesce(checklist_enabled_at, now())
   WHERE name_normalized = ANY(v_names)
     AND requires_checklist IS DISTINCT FROM true;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM set_config('mk9.allow_checklist_flag_change', '0', true);

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (NULL, 'mk9.industry.requires_checklist.backfill', 'mk9_industries', NULL,
          jsonb_build_object(
            'requested', v_names,
            'updated', v_updated,
            'not_found', ARRAY['imagina juntos','banana corrente']
          ));
END $$;

-- 4) Acao administrativa dedicada (unica forma de alterar a classificacao).
CREATE OR REPLACE FUNCTION public.mk9_set_industry_requires_checklist(
  p_industry_id uuid,
  p_value boolean,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (id uuid, name text, requires_checklist boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old boolean;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_mk9_admin() THEN
    RAISE EXCEPTION 'MK9_FORBIDDEN';
  END IF;

  SELECT i.requires_checklist INTO v_old
    FROM public.mk9_industries i WHERE i.id = p_industry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NOT_FOUND';
  END IF;

  PERFORM set_config('mk9.allow_checklist_flag_change', '1', true);
  UPDATE public.mk9_industries i
     SET requires_checklist = p_value,
         checklist_enabled_at = CASE WHEN p_value THEN now() ELSE i.checklist_enabled_at END,
         checklist_enabled_by = CASE WHEN p_value THEN v_uid ELSE i.checklist_enabled_by END
   WHERE i.id = p_industry_id;
  PERFORM set_config('mk9.allow_checklist_flag_change', '0', true);

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (v_uid, 'mk9.industry.requires_checklist.change', 'mk9_industries', p_industry_id::text,
          jsonb_build_object('old', v_old, 'new', p_value, 'reason', p_reason));

  RETURN QUERY
    SELECT i.id, i.name, i.requires_checklist
      FROM public.mk9_industries i WHERE i.id = p_industry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mk9_set_industry_requires_checklist(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mk9_set_industry_requires_checklist(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_set_industry_requires_checklist(uuid, boolean, text) TO service_role;