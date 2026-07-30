CREATE OR REPLACE FUNCTION public.mk9_admin_set_industry_requires_checklist(
  p_industry_id uuid,
  p_value boolean,
  p_reason text DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_source text DEFAULT 'ADMIN_UI',
  p_import_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, requires_checklist boolean, checklist_enabled_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old boolean;
  v_event text;
BEGIN
  SELECT i.requires_checklist INTO v_old
    FROM public.mk9_industries i WHERE i.id = p_industry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NOT_FOUND';
  END IF;

  IF p_value AND coalesce(v_old, false) THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_ALREADY_ENABLED';
  END IF;

  v_event := CASE
    WHEN p_value AND p_source = 'IMPORT' THEN 'CHECKLIST_ENABLED_DURING_IMPORT'
    WHEN p_value THEN 'CHECKLIST_ENABLED'
    ELSE 'CHECKLIST_DISABLED'
  END;

  PERFORM set_config('mk9.allow_checklist_flag_change', '1', true);
  UPDATE public.mk9_industries i
     SET requires_checklist = p_value,
         checklist_enabled_at = CASE WHEN p_value THEN now() ELSE i.checklist_enabled_at END,
         checklist_enabled_by = CASE WHEN p_value THEN coalesce(p_actor, i.checklist_enabled_by) ELSE i.checklist_enabled_by END
   WHERE i.id = p_industry_id;
  PERFORM set_config('mk9.allow_checklist_flag_change', '0', true);

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (p_actor, v_event, 'mk9_industries', p_industry_id::text,
          jsonb_build_object('old', v_old, 'new', p_value, 'reason', p_reason,
                             'source', p_source, 'import_id', p_import_id));

  RETURN QUERY
    SELECT i.id, i.name, i.requires_checklist, i.checklist_enabled_at
      FROM public.mk9_industries i WHERE i.id = p_industry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mk9_admin_create_checklist_industry(
  p_name text,
  p_actor uuid DEFAULT NULL,
  p_import_id uuid DEFAULT NULL,
  p_source text DEFAULT 'IMPORT'
)
RETURNS TABLE(id uuid, name text, requires_checklist boolean, checklist_enabled_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_norm text;
  v_id uuid;
BEGIN
  v_name := btrim(coalesce(p_name, ''));
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NAME_INVALID';
  END IF;
  v_norm := lower(btrim(regexp_replace(unaccent_safe_mk9(v_name), '\s+', ' ', 'g')));

  IF EXISTS (SELECT 1 FROM public.mk9_industries i WHERE i.name_normalized = v_norm) THEN
    RAISE EXCEPTION 'MK9_DUPLICATE_INDUSTRY';
  END IF;

  PERFORM set_config('mk9.allow_checklist_flag_change', '1', true);
  INSERT INTO public.mk9_industries (name, name_normalized, requires_checklist, checklist_enabled_at, checklist_enabled_by)
  VALUES (v_name, v_norm, true, now(), p_actor)
  RETURNING mk9_industries.id INTO v_id;
  PERFORM set_config('mk9.allow_checklist_flag_change', '0', true);

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (p_actor, 'INDUSTRY_CREATED_FOR_CHECKLIST', 'mk9_industries', v_id::text,
          jsonb_build_object('name', v_name, 'name_normalized', v_norm,
                             'source', p_source, 'import_id', p_import_id));

  RETURN QUERY
    SELECT i.id, i.name, i.requires_checklist, i.checklist_enabled_at
      FROM public.mk9_industries i WHERE i.id = v_id;
END;
$$;