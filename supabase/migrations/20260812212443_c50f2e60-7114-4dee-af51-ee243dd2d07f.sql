-- Adiciona coordenadas às lojas
ALTER TABLE public.mk9_stores 
ADD COLUMN latitude DOUBLE PRECISION, 
ADD COLUMN longitude DOUBLE PRECISION;

-- Adiciona dados de GPS às evidências
ALTER TABLE public.mk9_visit_evidence
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN accuracy_meters DOUBLE PRECISION,
ADD COLUMN distance_from_store_meters DOUBLE PRECISION,
ADD COLUMN location_status TEXT CHECK (location_status IN ('MATCH', 'REVIEW', 'OUTSIDE', 'UNAVAILABLE')),
ADD COLUMN location_captured_at TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN public.mk9_stores.latitude IS 'Latitude geográfica oficial da loja';
COMMENT ON COLUMN public.mk9_stores.longitude IS 'Longitude geográfica oficial da loja';
COMMENT ON COLUMN public.mk9_visit_evidence.location_status IS 'Status da validação geográfica (MATCH, REVIEW, OUTSIDE, UNAVAILABLE)';
