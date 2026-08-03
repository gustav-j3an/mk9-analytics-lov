-- Tabela para agrupar as importações de checklist em lote.
CREATE TABLE public.mk9_checklist_import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by uuid REFERENCES auth.users(id) NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT', -- DRAFT, ANALYZING, READY, PROCESSING, COMPLETED, PARTIAL, FAILED
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

-- Adiciona batch_id nas importações individuais.
ALTER TABLE public.mk9_checklist_imports ADD COLUMN batch_id uuid REFERENCES public.mk9_checklist_import_batches(id) ON DELETE SET NULL;

-- Segurança
GRANT SELECT ON public.mk9_checklist_import_batches TO authenticated;
GRANT ALL ON public.mk9_checklist_import_batches TO service_role;

ALTER TABLE public.mk9_checklist_import_batches ENABLE ROW LEVEL SECURITY;

-- Política: ADMIN lê tudo, usuário comum lê o que criou (embora no momento só ADMIN acesse o módulo).
CREATE POLICY "Admins can select all batches" ON public.mk9_checklist_import_batches
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can select own batches" ON public.mk9_checklist_import_batches
    FOR SELECT TO authenticated USING (auth.uid() = created_by);

-- Trigger de updated_at
CREATE TRIGGER set_mk9_checklist_import_batches_updated_at
    BEFORE UPDATE ON public.mk9_checklist_import_batches
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

