
CREATE TABLE public.mk9_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mk9_audit_logs TO authenticated;
GRANT ALL ON public.mk9_audit_logs TO service_role;

ALTER TABLE public.mk9_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mk9_audit_logs_self_select" ON public.mk9_audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX mk9_audit_logs_user_id_idx ON public.mk9_audit_logs(user_id);
CREATE INDEX mk9_audit_logs_action_idx ON public.mk9_audit_logs(action);
CREATE INDEX mk9_audit_logs_created_at_idx ON public.mk9_audit_logs(created_at DESC);
