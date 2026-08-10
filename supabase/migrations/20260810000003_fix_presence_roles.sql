-- Grant select to authenticated users for teams
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_presence_teams TO authenticated;
GRANT ALL ON public.mk9_presence_teams TO service_role;

-- Ensure RLS is active
ALTER TABLE public.mk9_presence_teams ENABLE ROW LEVEL SECURITY;

-- Simple policies for admin control
CREATE POLICY "Admins can manage presence teams" 
ON public.mk9_presence_teams
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view presence teams"
ON public.mk9_presence_teams
FOR SELECT
TO authenticated
USING (true);
