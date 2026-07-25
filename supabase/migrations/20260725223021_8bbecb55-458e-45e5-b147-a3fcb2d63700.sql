REVOKE EXECUTE ON FUNCTION public.mk9_handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_merge_stores(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_normalize_store_name(text) FROM PUBLIC, anon, authenticated;