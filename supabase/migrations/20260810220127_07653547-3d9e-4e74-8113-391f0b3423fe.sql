-- Re-creating the table as it seems to be missing from the public schema cache or was not applied correctly
CREATE TABLE IF NOT EXISTS public.mk9_presence_teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    supervisor_id uuid REFERENCES public.mk9_supervisors(id), -- Updated to use mk9_supervisors
    active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_presence_teams TO authenticated;
GRANT ALL ON public.mk9_presence_teams TO service_role;

ALTER TABLE public.mk9_presence_teams ENABLE ROW LEVEL SECURITY;

-- Simplified policy to ensure access during debugging
CREATE POLICY "Allow authenticated management on presence teams" ON public.mk9_presence_teams
    FOR ALL TO authenticated USING (true);

-- Ensure the column exists in promoters
ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS presence_team_id uuid REFERENCES public.mk9_presence_teams(id);
