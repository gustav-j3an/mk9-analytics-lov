CREATE TABLE public.mk9_presence_teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    supervisor_id uuid REFERENCES public.mk9_profiles(id),
    active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_presence_teams TO authenticated;
GRANT ALL ON public.mk9_presence_teams TO service_role;

ALTER TABLE public.mk9_presence_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated reads on presence teams" ON public.mk9_presence_teams
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to manage presence teams" ON public.mk9_presence_teams
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Link promoters to teams
ALTER TABLE public.mk9_promoters ADD COLUMN presence_team_id uuid REFERENCES public.mk9_presence_teams(id);

-- Migration of current "Supervisor A" group
DO $$
DECLARE
    team_a_id uuid;
    supervisor_a_id uuid := '3765698f-3d6b-4d75-a6a4-ddc48686318c';
BEGIN
    INSERT INTO public.mk9_presence_teams (name, supervisor_id)
    VALUES ('EQUIPE A', supervisor_a_id)
    RETURNING id INTO team_a_id;

    UPDATE public.mk9_promoters
    SET presence_team_id = team_a_id
    WHERE supervisor_id = supervisor_a_id;
END $$;
