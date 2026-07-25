
CREATE OR REPLACE FUNCTION public.mk9_normalize_store_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            coalesce(input, ''),
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
            'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
          )
        ),
        '[-–—/,.()·|]+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

-- Merge helper: mescla duas lojas (other -> canonical) repontando todas as FKs.
CREATE OR REPLACE FUNCTION public.mk9_merge_stores(canonical uuid, other uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF canonical = other THEN RETURN; END IF;

  -- industry_store_frequency: soma quando colidir por (industry_id, store_id)
  INSERT INTO mk9_industry_store_frequency (industry_id, store_id, weekly_frequency, monthly_frequency, last_import_id)
    SELECT industry_id, canonical, weekly_frequency, monthly_frequency, last_import_id
      FROM mk9_industry_store_frequency
     WHERE store_id = other
  ON CONFLICT (industry_id, store_id) DO UPDATE
    SET weekly_frequency  = COALESCE(mk9_industry_store_frequency.weekly_frequency, 0) + COALESCE(EXCLUDED.weekly_frequency, 0),
        monthly_frequency = COALESCE(mk9_industry_store_frequency.monthly_frequency, 0) + COALESCE(EXCLUDED.monthly_frequency, 0),
        last_import_id    = COALESCE(EXCLUDED.last_import_id, mk9_industry_store_frequency.last_import_id);
  DELETE FROM mk9_industry_store_frequency WHERE store_id = other;

  -- actual_visits: apaga colisões antes de repontar (unique industry_id, store_id, scheduled_date, origin)
  DELETE FROM mk9_actual_visits av
   WHERE av.store_id = other
     AND EXISTS (
       SELECT 1 FROM mk9_actual_visits av2
        WHERE av2.store_id = canonical
          AND av2.industry_id = av.industry_id
          AND av2.scheduled_date = av.scheduled_date
          AND av2.origin = av.origin
     );
  UPDATE mk9_actual_visits SET store_id = canonical WHERE store_id = other;

  -- planned tables e reconciliations
  UPDATE mk9_planned_visits SET store_id = canonical WHERE store_id = other;
  UPDATE mk9_planned_routes SET store_id = canonical WHERE store_id = other;
  UPDATE mk9_visit_reconciliations SET store_id = canonical WHERE store_id = other;

  DELETE FROM mk9_stores WHERE id = other;
END;
$$;

-- 1) Merge intra-UF: agrupa por (novo_normalizado, uf) e escolhe canônica
--    priorizando cadastros base (origin distinto de CHECKLIST_IMPORT) e mais antigos.
DO $$
DECLARE
  grp record;
  canonical uuid;
  other uuid;
BEGIN
  FOR grp IN
    SELECT nn, uf, array_agg(id ORDER BY (origin IS DISTINCT FROM 'CHECKLIST_IMPORT') DESC, created_at) AS ids
    FROM (SELECT id, mk9_normalize_store_name(name) AS nn, uf, origin, created_at FROM mk9_stores) x
    GROUP BY nn, uf
    HAVING count(*) > 1
  LOOP
    canonical := grp.ids[1];
    FOR i IN 2..array_length(grp.ids, 1) LOOP
      other := grp.ids[i];
      PERFORM mk9_merge_stores(canonical, other);
    END LOOP;
  END LOOP;
END $$;

-- 2) Merge cross-UF apenas quando existe exatamente UMA loja base para o
--    nome normalizado. Absorve lojas criadas pelo importador de checklist com
--    UF divergente para dentro do cadastro base correto.
DO $$
DECLARE
  grp record;
  canonical uuid;
  other uuid;
BEGIN
  FOR grp IN
    SELECT nn,
           (array_agg(id ORDER BY (origin IS DISTINCT FROM 'CHECKLIST_IMPORT') DESC, created_at))[1] AS canonical_id,
           array_agg(id ORDER BY (origin IS DISTINCT FROM 'CHECKLIST_IMPORT') DESC, created_at) AS ids,
           count(*) FILTER (WHERE origin IS DISTINCT FROM 'CHECKLIST_IMPORT') AS bases
    FROM (SELECT id, mk9_normalize_store_name(name) AS nn, origin, created_at FROM mk9_stores) x
    GROUP BY nn
    HAVING count(*) > 1
       AND count(*) FILTER (WHERE origin IS DISTINCT FROM 'CHECKLIST_IMPORT') = 1
  LOOP
    canonical := grp.canonical_id;
    FOR i IN 1..array_length(grp.ids, 1) LOOP
      other := grp.ids[i];
      IF other <> canonical THEN
        PERFORM mk9_merge_stores(canonical, other);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 3) Backfill do name_normalized com a nova função em todas as lojas restantes.
UPDATE mk9_stores
   SET name_normalized = mk9_normalize_store_name(name)
 WHERE name_normalized IS DISTINCT FROM mk9_normalize_store_name(name);

NOTIFY pgrst, 'reload schema';
