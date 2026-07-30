CREATE OR REPLACE FUNCTION public.mk9_admin_set_industry_requires_checklist(
  p_industry_id uuid,
  p_value boolean,
  p_reason text DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, name text, requires_checklist boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old boolean;
BEGIN
  SELECT i.requires_checklist INTO v_old
    FROM public.mk9_industries i WHERE i.id = p_industry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NOT_FOUND';
  END IF;

  PERFORM set_config('mk9.allow_checklist_flag_change', '1', true);
  UPDATE public.mk9_industries i
     SET requires_checklist = p_value,
         checklist_enabled_at = CASE WHEN p_value THEN now() ELSE i.checklist_enabled_at END,
         checklist_enabled_by = CASE WHEN p_value THEN coalesce(p_actor, i.checklist_enabled_by) ELSE i.checklist_enabled_by END
   WHERE i.id = p_industry_id;
  PERFORM set_config('mk9.allow_checklist_flag_change', '0', true);

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (p_actor, 'mk9.industry.requires_checklist.change', 'mk9_industries', p_industry_id::text,
          jsonb_build_object('old', v_old, 'new', p_value, 'reason', p_reason));

  RETURN QUERY
    SELECT i.id, i.name, i.requires_checklist
      FROM public.mk9_industries i WHERE i.id = p_industry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mk9_admin_set_industry_requires_checklist(uuid, boolean, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mk9_admin_set_industry_requires_checklist(uuid, boolean, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.mk9_admin_set_industry_requires_checklist(uuid, boolean, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_admin_set_industry_requires_checklist(uuid, boolean, text, uuid) TO service_role;