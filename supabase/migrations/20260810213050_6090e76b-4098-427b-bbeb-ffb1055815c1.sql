-- Create Enum for Presence Status if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'presence_status') THEN
        CREATE TYPE public.presence_status AS ENUM ('PRESENT', 'ABSENT', 'MEDICAL_CERTIFICATE');
    END IF;
END $$;

-- Create Presence Table if not exists
CREATE TABLE IF NOT EXISTS public.mk9_promoter_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    promoter_id UUID NOT NULL REFERENCES public.mk9_promoters(id) ON DELETE CASCADE,
    status public.presence_status NOT NULL,
    observation TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(date, promoter_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_promoter_presence TO authenticated;
GRANT ALL ON public.mk9_promoter_presence TO service_role;

-- RLS
ALTER TABLE public.mk9_promoter_presence ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow authenticated users to read presence') THEN
        CREATE POLICY "Allow authenticated users to read presence"
        ON public.mk9_promoter_presence FOR SELECT
        TO authenticated
        USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow authenticated users to insert presence') THEN
        CREATE POLICY "Allow authenticated users to insert presence"
        ON public.mk9_promoter_presence FOR INSERT
        TO authenticated
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow authenticated users to update presence') THEN
        CREATE POLICY "Allow authenticated users to update presence"
        ON public.mk9_promoter_presence FOR UPDATE
        TO authenticated
        USING (true);
    END IF;
END $$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_presence_updated_at ON public.mk9_promoter_presence;
CREATE TRIGGER set_presence_updated_at
    BEFORE UPDATE ON public.mk9_promoter_presence
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
