CREATE OR REPLACE FUNCTION public.mk9_sync_planned_visits(
  _rows jsonb,
  _archive_ids uuid[],
  _import_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer := 0;
  inserted_count integer := 0;
  archived_count integer := 0;
BEGIN
  IF jsonb_typeof(COALESCE(_rows, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'mk9_sync_planned_visits expects _rows to be a JSON array';
  END IF;

  WITH incoming AS (
    SELECT DISTINCT ON (promoter_id, store_id, industry_id, scheduled_date)
      (item->>'promoter_id')::uuid AS promoter_id,
      (item->>'store_id')::uuid AS store_id,
      (item->>'industry_id')::uuid AS industry_id,
      NULLIF(item->>'route_id', '')::uuid AS route_id,
      (item->>'scheduled_date')::date AS scheduled_date,
      COALESCE(NULLIF(item->>'status', ''), 'planned')::public.mk9_visit_status AS status,
      NULLIF(item->>'source_sheet', '') AS source_sheet
    FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) AS item
    WHERE item ? 'promoter_id'
      AND item ? 'store_id'
      AND item ? 'industry_id'
      AND item ? 'scheduled_date'
    ORDER BY promoter_id, store_id, industry_id, scheduled_date
  )
  UPDATE public.mk9_planned_visits AS pv
     SET route_id = incoming.route_id,
         status = CASE
           WHEN pv.status <> 'planned'::public.mk9_visit_status THEN pv.status
           ELSE incoming.status
         END,
         source_sheet = incoming.source_sheet,
         last_import_id = _import_id,
         archived_at = NULL,
         updated_at = now()
    FROM incoming
   WHERE pv.promoter_id = incoming.promoter_id
     AND pv.store_id = incoming.store_id
     AND pv.industry_id = incoming.industry_id
     AND pv.scheduled_date = incoming.scheduled_date;
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  WITH incoming AS (
    SELECT DISTINCT ON (promoter_id, store_id, industry_id, scheduled_date)
      (item->>'promoter_id')::uuid AS promoter_id,
      (item->>'store_id')::uuid AS store_id,
      (item->>'industry_id')::uuid AS industry_id,
      NULLIF(item->>'route_id', '')::uuid AS route_id,
      (item->>'scheduled_date')::date AS scheduled_date,
      COALESCE(NULLIF(item->>'status', ''), 'planned')::public.mk9_visit_status AS status,
      NULLIF(item->>'source_sheet', '') AS source_sheet
    FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) AS item
    WHERE item ? 'promoter_id'
      AND item ? 'store_id'
      AND item ? 'industry_id'
      AND item ? 'scheduled_date'
    ORDER BY promoter_id, store_id, industry_id, scheduled_date
  )
  INSERT INTO public.mk9_planned_visits (
    promoter_id,
    store_id,
    industry_id,
    route_id,
    scheduled_date,
    status,
    source_sheet,
    last_import_id,
    archived_at
  )
  SELECT
    incoming.promoter_id,
    incoming.store_id,
    incoming.industry_id,
    incoming.route_id,
    incoming.scheduled_date,
    incoming.status,
    incoming.source_sheet,
    _import_id,
    NULL
  FROM incoming
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.mk9_planned_visits AS pv
    WHERE pv.promoter_id = incoming.promoter_id
      AND pv.store_id = incoming.store_id
      AND pv.industry_id = incoming.industry_id
      AND pv.scheduled_date = incoming.scheduled_date
  )
  ON CONFLICT (promoter_id, store_id, industry_id, scheduled_date) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF COALESCE(array_length(_archive_ids, 1), 0) > 0 THEN
    UPDATE public.mk9_planned_visits
       SET archived_at = now(),
           updated_at = now()
     WHERE id = ANY(_archive_ids)
       AND status = 'planned'::public.mk9_visit_status
       AND archived_at IS NULL;
    GET DIAGNOSTICS archived_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'updated', updated_count,
    'inserted', inserted_count,
    'archived', archived_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mk9_sync_planned_visits(jsonb, uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_sync_planned_visits(jsonb, uuid[], uuid) TO service_role;