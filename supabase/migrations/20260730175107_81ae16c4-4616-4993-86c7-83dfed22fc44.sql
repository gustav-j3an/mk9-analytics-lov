DROP FUNCTION IF EXISTS public.mk9_admin_create_checklist_industry(text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.mk9_admin_create_checklist_industry(
  p_name text,
  p_name_normalized text,
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
  v_norm := lower(btrim(coalesce(p_name_normalized, '')));
  IF length(v_name) < 2 OR length(v_norm) < 2 THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NAME_INVALID';
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.mk9_admin_create_checklist_industry(text, text, uuid, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_admin_set_industry_requires_checklist(uuid, boolean, text, uuid, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_admin_create_checklist_industry(text, text, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_admin_set_industry_requires_checklist(uuid, boolean, text, uuid, text, uuid) TO service_role;