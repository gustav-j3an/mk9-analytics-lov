
CREATE TABLE IF NOT EXISTS public.mk9_checklist_import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by uuid REFERENCES auth.users(id) NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    total_files integer NOT NULL DEFAULT 0,
    ready_files integer NOT NULL DEFAULT 0,
    imported_files integer NOT NULL DEFAULT 0,
    review_files integer NOT NULL DEFAULT 0,
    failed_files integer NOT NULL DEFAULT 0,
    started_at timestamptz,
    finished_at timestamptz,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mk9_checklist_imports' AND column_name='batch_id') THEN
    ALTER TABLE public.mk9_checklist_imports ADD COLUMN batch_id uuid REFERENCES public.mk9_checklist_import_batches(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT SELECT ON public.mk9_checklist_import_batches TO authenticated;
GRANT ALL ON public.mk9_checklist_import_batches TO service_role;

ALTER TABLE public.mk9_checklist_import_batches ENABLE ROW LEVEL SECURITY;

-- Nota: usei cast explícito para mk9_role
CREATE POLICY "Admins can select all batches" ON public.mk9_checklist_import_batches
    FOR SELECT TO authenticated USING (public.is_mk9_admin() OR public.has_mk9_role(auth.uid(), 'ADMIN'::public.mk9_role));

CREATE POLICY "Users can select own batches" ON public.mk9_checklist_import_batches
    FOR SELECT TO authenticated USING (auth.uid() = created_by);
