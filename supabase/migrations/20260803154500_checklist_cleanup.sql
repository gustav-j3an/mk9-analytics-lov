-- Tabela para log de auditoria de limpezas administrativas
CREATE TABLE public.mk9_checklist_cleanup_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    industry_id uuid REFERENCES public.mk9_industries(id) NOT NULL,
    operation_month integer NOT NULL,
    operation_year integer NOT NULL,
    justification text NOT NULL,
    impact_summary jsonb NOT NULL, -- { import_ids: [], visits_removed: 0, frequencies_affected: 0 }
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Permissões
GRANT SELECT, INSERT ON public.mk9_checklist_cleanup_logs TO authenticated;
GRANT ALL ON public.mk9_checklist_cleanup_logs TO service_role;

ALTER TABLE public.mk9_checklist_cleanup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cleanup logs"
ON public.mk9_checklist_cleanup_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert cleanup logs"
ON public.mk9_checklist_cleanup_logs FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
