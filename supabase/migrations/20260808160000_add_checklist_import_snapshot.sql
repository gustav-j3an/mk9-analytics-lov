CREATE TABLE public.mk9_checklist_import_store_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id uuid NOT NULL REFERENCES public.mk9_checklist_imports(id) ON DELETE CASCADE,
    industry_id uuid NOT NULL REFERENCES public.mk9_industries(id) ON DELETE CASCADE,
    store_id uuid NOT NULL REFERENCES public.mk9_stores(id) ON DELETE CASCADE,
    source_store_name text NOT NULL,
    uf text,
    weekly_frequency numeric,
    monthly_frequency numeric,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (import_id, store_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_checklist_import_store_snapshots TO authenticated;
GRANT ALL ON public.mk9_checklist_import_store_snapshots TO service_role;

ALTER TABLE public.mk9_checklist_import_store_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on snapshots"
ON public.mk9_checklist_import_store_snapshots
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX mk9_checklist_import_store_snapshots_import_idx ON public.mk9_checklist_import_store_snapshots (import_id);
CREATE INDEX mk9_checklist_import_store_snapshots_store_idx ON public.mk9_checklist_import_store_snapshots (store_id);
