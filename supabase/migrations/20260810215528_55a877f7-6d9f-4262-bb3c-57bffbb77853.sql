-- 1. Create mk9_supervisors table
CREATE TABLE IF NOT EXISTS public.mk9_supervisors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_supervisors TO authenticated;
GRANT ALL ON public.mk9_supervisors TO service_role;

-- 3. Enable RLS
ALTER TABLE public.mk9_supervisors ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Unified policy for authenticated access)
CREATE POLICY "Supervisors are manageable by authenticated users"
    ON public.mk9_supervisors FOR ALL
    TO authenticated
    USING (true);

-- 5. Add mk9_supervisor_id to mk9_promoters (source of truth)
ALTER TABLE public.mk9_promoters ADD COLUMN IF NOT EXISTS mk9_supervisor_id UUID REFERENCES public.mk9_supervisors(id);

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mk9_supervisors_updated_at') THEN
        CREATE TRIGGER update_mk9_supervisors_updated_at
            BEFORE UPDATE ON public.mk9_supervisors
            FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;
