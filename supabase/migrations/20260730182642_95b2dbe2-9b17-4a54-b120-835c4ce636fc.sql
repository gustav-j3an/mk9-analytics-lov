ALTER TABLE public.mk9_industries
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'IMPORT',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS mk9_industries_name_normalized_uidx
  ON public.mk9_industries (name_normalized);

CREATE INDEX IF NOT EXISTS mk9_industries_archived_at_idx
  ON public.mk9_industries (archived_at);

-- ---------------------------------------------------------------------------
-- Criar indústria manualmente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_admin_create_industry(
  p_name text,
  p_name_normalized text,
  p_display_name text,
  p_notes text,
  p_requires_checklist boolean,
  p_period_type text,
  p_start_day smallint,
  p_end_day smallint,
  p_uses_previous_month boolean,
  p_actor uuid
)
RETURNS TABLE (id uuid, name text, requires_checklist boolean, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_norm text;
  v_id uuid;
BEGIN
  v_name := btrim(coalesce(p_name, ''));
  v_norm := lower(btrim(coalesce(p_name_normalized, '')));
  IF length(v_name) < 2 OR length(v_norm) < 2 THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NAME_INVALID';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mk9_industries i WHERE i.name_normalized = v_norm) THEN
    RAISE EXCEPTION 'MK9_DUPLICATE_INDUSTRY';
  END IF;

  PERFORM set_config('mk9.allow_checklist_flag_change', '1', true);
  INSERT INTO public.mk9_industries (
    name, name_normalized, display_name, notes, source_type,
    requires_checklist, checklist_enabled_at, checklist_enabled_by,
    created_by, updated_by
  )
  VALUES (
    v_name, v_norm, nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''), 'MANUAL',
    coalesce(p_requires_checklist, false),
    CASE WHEN coalesce(p_requires_checklist, false) THEN now() ELSE NULL END,
    CASE WHEN coalesce(p_requires_checklist, false) THEN p_actor ELSE NULL END,
    p_actor, p_actor
  )
  RETURNING mk9_industries.id INTO v_id;
  PERFORM set_config('mk9.allow_checklist_flag_change', '0', true);

  IF coalesce(p_period_type, 'CALENDAR_MONTH') = 'CUSTOM_CYCLE' THEN
    INSERT INTO public.mk9_industry_period_config (
      industry_id, period_type, start_day, end_day, uses_previous_month, active
    ) VALUES (
      v_id, 'CUSTOM_CYCLE'::mk9_period_type,
      coalesce(p_start_day, 1), coalesce(p_end_day, 31),
      coalesce(p_uses_previous_month, false), true
    );
  END IF;

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (p_actor, 'INDUSTRY_CREATED_MANUAL', 'mk9_industries', v_id::text,
          jsonb_build_object('name', v_name, 'name_normalized', v_norm,
                             'requires_checklist', coalesce(p_requires_checklist, false),
                             'period_type', coalesce(p_period_type, 'CALENDAR_MONTH')));

  RETURN QUERY
    SELECT i.id, i.name, i.requires_checklist, i.updated_at
      FROM public.mk9_industries i WHERE i.id = v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Editar cadastro (concorrência otimista dentro da transação)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_admin_update_industry(
  p_industry_id uuid,
  p_expected_updated_at timestamptz,
  p_name text,
  p_name_normalized text,
  p_display_name text,
  p_notes text,
  p_requires_checklist boolean,
  p_actor uuid
)
RETURNS TABLE (id uuid, name text, requires_checklist boolean, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_norm text;
  v_old record;
  v_touched integer;
BEGIN
  v_name := btrim(coalesce(p_name, ''));
  v_norm := lower(btrim(coalesce(p_name_normalized, '')));
  IF length(v_name) < 2 OR length(v_norm) < 2 THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NAME_INVALID';
  END IF;

  SELECT i.name, i.display_name, i.notes, i.requires_checklist, i.archived_at
    INTO v_old
    FROM public.mk9_industries i
   WHERE i.id = p_industry_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NOT_FOUND';
  END IF;
  IF v_old.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_ARCHIVED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mk9_industries i
     WHERE i.name_normalized = v_norm AND i.id <> p_industry_id
  ) THEN
    RAISE EXCEPTION 'MK9_DUPLICATE_INDUSTRY';
  END IF;

  PERFORM set_config('mk9.allow_checklist_flag_change', '1', true);
  UPDATE public.mk9_industries i
     SET name = v_name,
         name_normalized = v_norm,
         display_name = nullif(btrim(coalesce(p_display_name, '')), ''),
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         requires_checklist = coalesce(p_requires_checklist, i.requires_checklist),
         checklist_enabled_at = CASE
           WHEN coalesce(p_requires_checklist, i.requires_checklist) AND i.checklist_enabled_at IS NULL
             THEN now() ELSE i.checklist_enabled_at END,
         checklist_enabled_by = CASE
           WHEN coalesce(p_requires_checklist, i.requires_checklist) AND i.checklist_enabled_by IS NULL
             THEN p_actor ELSE i.checklist_enabled_by END,
         updated_by = p_actor
   WHERE i.id = p_industry_id
     AND (p_expected_updated_at IS NULL OR i.updated_at = p_expected_updated_at);
  GET DIAGNOSTICS v_touched = ROW_COUNT;
  PERFORM set_config('mk9.allow_checklist_flag_change', '0', true);

  IF v_touched = 0 THEN
    RAISE EXCEPTION 'MK9_CONCURRENT_UPDATE';
  END IF;

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (p_actor, 'INDUSTRY_UPDATED', 'mk9_industries', p_industry_id::text,
          jsonb_build_object(
            'old', jsonb_build_object('name', v_old.name, 'display_name', v_old.display_name,
                                      'notes', v_old.notes, 'requires_checklist', v_old.requires_checklist),
            'new', jsonb_build_object('name', v_name, 'display_name', p_display_name,
                                      'notes', p_notes, 'requires_checklist', p_requires_checklist)));

  RETURN QUERY
    SELECT i.id, i.name, i.requires_checklist, i.updated_at
      FROM public.mk9_industries i WHERE i.id = p_industry_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Arquivar (nunca apaga)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_admin_archive_industry(
  p_industry_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text,
  p_actor uuid
)
RETURNS TABLE (id uuid, name text, archived_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_touched integer;
  v_archived timestamptz;
BEGIN
  SELECT i.archived_at INTO v_archived
    FROM public.mk9_industries i WHERE i.id = p_industry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NOT_FOUND';
  END IF;
  IF v_archived IS NOT NULL THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_ALREADY_ARCHIVED';
  END IF;

  UPDATE public.mk9_industries i
     SET archived_at = now(),
         archived_by = p_actor,
         archive_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         updated_by = p_actor
   WHERE i.id = p_industry_id
     AND (p_expected_updated_at IS NULL OR i.updated_at = p_expected_updated_at);
  GET DIAGNOSTICS v_touched = ROW_COUNT;
  IF v_touched = 0 THEN
    RAISE EXCEPTION 'MK9_CONCURRENT_UPDATE';
  END IF;

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (p_actor, 'INDUSTRY_ARCHIVED', 'mk9_industries', p_industry_id::text,
          jsonb_build_object('reason', p_reason));

  RETURN QUERY
    SELECT i.id, i.name, i.archived_at, i.updated_at
      FROM public.mk9_industries i WHERE i.id = p_industry_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reativar (não religa checklist)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_admin_reactivate_industry(
  p_industry_id uuid,
  p_expected_updated_at timestamptz,
  p_actor uuid
)
RETURNS TABLE (id uuid, name text, archived_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_touched integer;
  v_archived timestamptz;
BEGIN
  SELECT i.archived_at INTO v_archived
    FROM public.mk9_industries i WHERE i.id = p_industry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NOT_FOUND';
  END IF;
  IF v_archived IS NULL THEN
    RAISE EXCEPTION 'MK9_INDUSTRY_NOT_ARCHIVED';
  END IF;

  UPDATE public.mk9_industries i
     SET archived_at = NULL,
         archived_by = NULL,
         archive_reason = NULL,
         updated_by = p_actor
   WHERE i.id = p_industry_id
     AND (p_expected_updated_at IS NULL OR i.updated_at = p_expected_updated_at);
  GET DIAGNOSTICS v_touched = ROW_COUNT;
  IF v_touched = 0 THEN
    RAISE EXCEPTION 'MK9_CONCURRENT_UPDATE';
  END IF;

  INSERT INTO public.mk9_audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (p_actor, 'INDUSTRY_REACTIVATED', 'mk9_industries', p_industry_id::text,
          jsonb_build_object('requires_checklist_preserved', true));

  RETURN QUERY
    SELECT i.id, i.name, i.archived_at, i.updated_at
      FROM public.mk9_industries i WHERE i.id = p_industry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mk9_admin_create_industry(text, text, text, text, boolean, text, smallint, smallint, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_admin_update_industry(uuid, timestamptz, text, text, text, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_admin_archive_industry(uuid, timestamptz, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_admin_reactivate_industry(uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mk9_admin_create_industry(text, text, text, text, boolean, text, smallint, smallint, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_admin_update_industry(uuid, timestamptz, text, text, text, text, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_admin_archive_industry(uuid, timestamptz, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_admin_reactivate_industry(uuid, timestamptz, uuid) TO service_role;