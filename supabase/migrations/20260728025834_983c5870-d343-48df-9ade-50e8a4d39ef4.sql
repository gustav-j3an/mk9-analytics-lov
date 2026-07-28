CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS mk9_stores_name_normalized_trgm
  ON public.mk9_stores USING gin (name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS mk9_stores_chain_trgm
  ON public.mk9_stores USING gin (lower(coalesce(chain,'')) gin_trgm_ops);