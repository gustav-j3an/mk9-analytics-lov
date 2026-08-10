-- Create freelancer status enum
CREATE TYPE public.mk9_freelancer_daily_status AS ENUM ('PLANEJADA', 'REALIZADA', 'CANCELADA');

-- Create freelancers table
CREATE TABLE public.mk9_freelancers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    city TEXT,
    uf TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create daily rates table
CREATE TABLE public.mk9_freelancer_dailies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    freelancer_id UUID REFERENCES public.mk9_freelancers(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status public.mk9_freelancer_daily_status DEFAULT 'PLANEJADA' NOT NULL,
    supervisor_id UUID REFERENCES public.mk9_supervisors(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create daily items (visits/services) table
CREATE TABLE public.mk9_freelancer_daily_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_id UUID REFERENCES public.mk9_freelancer_dailies(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.mk9_stores(id) ON DELETE CASCADE NOT NULL,
    industry_id UUID REFERENCES public.mk9_industries(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(daily_id, store_id, industry_id)
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_freelancers TO authenticated;
GRANT ALL ON public.mk9_freelancers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_freelancer_dailies TO authenticated;
GRANT ALL ON public.mk9_freelancer_dailies TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mk9_freelancer_daily_items TO authenticated;
GRANT ALL ON public.mk9_freelancer_daily_items TO service_role;

-- Enable RLS
ALTER TABLE public.mk9_freelancers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mk9_freelancer_dailies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mk9_freelancer_daily_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated full access to mk9_freelancers" ON public.mk9_freelancers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to mk9_freelancer_dailies" ON public.mk9_freelancer_dailies FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to mk9_freelancer_daily_items" ON public.mk9_freelancer_daily_items FOR ALL TO authenticated USING (true);

-- Functions for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_freelancers
BEFORE UPDATE ON public.mk9_freelancers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_dailies
BEFORE UPDATE ON public.mk9_freelancer_dailies
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

