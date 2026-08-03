CREATE TABLE public.mk9_bulk_exports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    competence_month integer not null,
    competence_year integer not null,
    format text not null check (format in ('zip', 'pdf')),
    filters jsonb default '{}'::jsonb,
    selected_industries_count integer not null default 0,
    industries_with_pending_count integer not null default 0,
    total_unattended_stores integer not null default 0,
    total_contracted_visits integer not null default 0,
    status text not null default 'QUEUED' check (status in ('QUEUED', 'GENERATING', 'COMPLETED', 'COMPLETED_WITH_ALERTS', 'FAILED')),
    progress_current integer not null default 0,
    progress_total integer not null default 0,
    error_message text,
    download_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE ON public.mk9_bulk_exports TO authenticated;
GRANT ALL ON public.mk9_bulk_exports TO service_role;

ALTER TABLE public.mk9_bulk_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own exports" ON public.mk9_bulk_exports
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mk9_bulk_export_items (
    id uuid primary key default gen_random_uuid(),
    export_id uuid references public.mk9_bulk_exports(id) on delete cascade not null,
    industry_id uuid references public.mk9_industries(id) on delete cascade not null,
    status text not null default 'QUEUED' check (status in ('QUEUED', 'CALCULATING', 'GENERATING', 'COMPLETED', 'SKIPPED', 'ERROR')),
    unattended_stores_count integer not null default 0,
    contracted_visits_sum integer not null default 0,
    period_start date,
    period_end date,
    error_details text,
    created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE ON public.mk9_bulk_export_items TO authenticated;
GRANT ALL ON public.mk9_bulk_export_items TO service_role;

ALTER TABLE public.mk9_bulk_export_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export items" ON public.mk9_bulk_export_items
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.mk9_bulk_exports
        WHERE id = export_id AND user_id = auth.uid()
    )
);