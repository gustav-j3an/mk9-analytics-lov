REVOKE EXECUTE ON FUNCTION public.mk9_admin_create_checklist_industry(text, text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_admin_set_industry_requires_checklist(uuid, boolean, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_revert_checklist_import(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_set_industry_requires_checklist(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_admin_create_checklist_industry(text, text, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_admin_set_industry_requires_checklist(uuid, boolean, text, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_revert_checklist_import(uuid, text, uuid) TO service_role;