REVOKE EXECUTE ON FUNCTION public.mk9_admin_create_checklist_industry(text, text, uuid, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_admin_set_industry_requires_checklist(uuid, boolean, text, uuid, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_revert_checklist_import(uuid, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mk9_set_industry_requires_checklist(uuid, boolean, text) FROM anon, authenticated;

-- Storage: bucket privado "reports" sem acesso direto de clientes.
CREATE POLICY "mk9_reports_no_client_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id <> 'reports' AND owner = auth.uid());

CREATE POLICY "mk9_reports_no_client_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id <> 'reports' AND owner = auth.uid());

CREATE POLICY "mk9_reports_no_client_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id <> 'reports' AND owner = auth.uid())
WITH CHECK (bucket_id <> 'reports' AND owner = auth.uid());

CREATE POLICY "mk9_reports_no_client_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id <> 'reports' AND owner = auth.uid());