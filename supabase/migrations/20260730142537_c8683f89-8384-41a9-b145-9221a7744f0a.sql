-- ============================================================
-- MK9 — Fase 2B.4: responsabilidade, prazo e resolução
-- ============================================================

ALTER TABLE public.mk9_data_quality_issues
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_at         timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by         uuid,
  ADD COLUMN IF NOT EXISTS assignment_note     text,
  ADD COLUMN IF NOT EXISTS priority            text NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS due_at              timestamptz,
  ADD COLUMN IF NOT EXISTS started_at          timestamptz,
  ADD COLUMN IF NOT EXISTS ignore_until        timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_type     text,
  ADD COLUMN IF NOT EXISTS resolution_forced   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_comment_at     timestamptz;

DO $$ BEGIN
  ALTER TABLE public.mk9_data_quality_issues
    ADD CONSTRAINT mk9_dq_priority_chk
    CHECK (priority = ANY (ARRAY['LOW','NORMAL','HIGH','URGENT']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.mk9_data_quality_issues
    ADD CONSTRAINT mk9_dq_resolution_type_chk
    CHECK (resolution_type IS NULL OR resolution_type = ANY (ARRAY[
      'DATA_FIXED','CONFIGURATION_FIXED','IMPORT_REPROCESSED','DUPLICATE_REVIEWED',
      'ROUTE_FIXED','FREQUENCY_FIXED','ACCEPTED_AS_VALID','OTHER']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS mk9_dq_assigned_idx
  ON public.mk9_data_quality_issues (assigned_to_user_id, status)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS mk9_dq_due_idx
  ON public.mk9_data_quality_issues (due_at)
  WHERE archived_at IS NULL;

-- updated_at sempre coerente (base da concorrência otimista)
CREATE OR REPLACE FUNCTION public.mk9_dq_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS mk9_dq_touch_updated_at ON public.mk9_data_quality_issues;
CREATE TRIGGER mk9_dq_touch_updated_at
  BEFORE UPDATE ON public.mk9_data_quality_issues
  FOR EACH ROW EXECUTE FUNCTION public.mk9_dq_touch_updated_at();

-- ------------------------------------------------------------
-- SLA padrão por severidade (regra central, em dias úteis)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_quality_default_due_at(_severity text, _from timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  days int;
  cursor_date date := (_from AT TIME ZONE 'America/Sao_Paulo')::date;
  added int := 0;
BEGIN
  days := CASE _severity
            WHEN 'BLOQUEANTE' THEN 0
            WHEN 'CRITICO'    THEN 1
            WHEN 'ATENCAO'    THEN 3
            WHEN 'AVISO'      THEN 5
            ELSE NULL END;
  IF days IS NULL THEN RETURN NULL; END IF;

  WHILE added < days LOOP
    cursor_date := cursor_date + 1;
    IF EXTRACT(ISODOW FROM cursor_date) < 6 THEN added := added + 1; END IF;
  END LOOP;

  RETURN ((cursor_date + time '23:59:59') AT TIME ZONE 'America/Sao_Paulo');
END $$;

-- Preenche prazo das ocorrências ativas já existentes
UPDATE public.mk9_data_quality_issues
   SET due_at = public.mk9_quality_default_due_at(severity, first_detected_at)
 WHERE due_at IS NULL
   AND archived_at IS NULL
   AND status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','REOPENED');

-- ------------------------------------------------------------
-- Novos tipos de evento
-- ------------------------------------------------------------
ALTER TABLE public.mk9_data_quality_issue_events DROP CONSTRAINT IF EXISTS mk9_dq_event_type_chk;
ALTER TABLE public.mk9_data_quality_issue_events
  ADD CONSTRAINT mk9_dq_event_type_chk CHECK (event_type = ANY (ARRAY[
    'DETECTED','SEEN_AGAIN','ACKNOWLEDGED','STARTED','RESOLVED','RESOLVED_AUTO',
    'IGNORED','REOPENED','EVIDENCE_UPDATED',
    'ASSIGNED','REASSIGNED','UNASSIGNED',
    'DUE_DATE_SET','DUE_DATE_CHANGED','PRIORITY_CHANGED',
    'COMMENT_ADDED','COMMENT_EDITED','COMMENT_ARCHIVED']));

-- ------------------------------------------------------------
-- Comentários
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mk9_data_quality_issue_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    uuid NOT NULL REFERENCES public.mk9_data_quality_issues(id) ON DELETE CASCADE,
  author_id   uuid,
  body        text NOT NULL,
  visibility  text NOT NULL DEFAULT 'INTERNAL',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT mk9_dq_comment_body_chk CHECK (length(btrim(body)) BETWEEN 2 AND 2000),
  CONSTRAINT mk9_dq_comment_visibility_chk CHECK (visibility = ANY (ARRAY['INTERNAL','CLIENT_VISIBLE']))
);

GRANT ALL ON public.mk9_data_quality_issue_comments TO service_role;
ALTER TABLE public.mk9_data_quality_issue_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS mk9_dq_comment_issue_idx
  ON public.mk9_data_quality_issue_comments (issue_id, created_at DESC);

DROP TRIGGER IF EXISTS mk9_dq_comment_touch ON public.mk9_data_quality_issue_comments;
CREATE TRIGGER mk9_dq_comment_touch
  BEFORE UPDATE ON public.mk9_data_quality_issue_comments
  FOR EACH ROW EXECUTE FUNCTION public.mk9_dq_touch_updated_at();

-- ------------------------------------------------------------
-- Guarda de concorrência (versão otimista)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_quality_check_version(_cur timestamptz, _expected timestamptz)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF _expected IS NOT NULL AND _cur IS DISTINCT FROM _expected THEN
    RAISE EXCEPTION 'MK9_DQ_STALE_VERSION';
  END IF;
END $$;

-- ------------------------------------------------------------
-- Atribuição
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_quality_assign_issue(
  _issue_id uuid,
  _assignee uuid,
  _actor_id uuid,
  _note text DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL
) RETURNS public.mk9_data_quality_issues
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur     public.mk9_data_quality_issues%ROWTYPE;
  updated public.mk9_data_quality_issues%ROWTYPE;
  ev      text;
BEGIN
  SELECT * INTO cur FROM public.mk9_data_quality_issues WHERE id = _issue_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'MK9_DQ_NOT_FOUND'; END IF;
  PERFORM public.mk9_quality_check_version(cur.updated_at, _expected_updated_at);

  IF _assignee IS NULL THEN
    ev := 'UNASSIGNED';
  ELSIF cur.assigned_to_user_id IS NULL THEN
    ev := 'ASSIGNED';
  ELSIF cur.assigned_to_user_id = _assignee THEN
    ev := 'ASSIGNED';
  ELSE
    ev := 'REASSIGNED';
  END IF;

  UPDATE public.mk9_data_quality_issues SET
    assigned_to_user_id = _assignee,
    assigned_at         = CASE WHEN _assignee IS NULL THEN NULL ELSE now() END,
    assigned_by         = CASE WHEN _assignee IS NULL THEN NULL ELSE _actor_id END,
    assignment_note     = CASE WHEN _assignee IS NULL THEN NULL ELSE _note END
  WHERE id = _issue_id
  RETURNING * INTO updated;

  INSERT INTO public.mk9_data_quality_issue_events
    (issue_id, event_type, from_status, to_status, actor_id, reason, metadata)
  VALUES (_issue_id, ev, cur.status, cur.status, _actor_id, _note,
          jsonb_build_object('from_assignee', cur.assigned_to_user_id, 'to_assignee', _assignee));

  RETURN updated;
END $$;

-- ------------------------------------------------------------
-- Prioridade e prazo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_quality_set_planning(
  _issue_id uuid,
  _priority text,
  _due_at timestamptz,
  _clear_due boolean,
  _actor_id uuid,
  _reason text DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL
) RETURNS public.mk9_data_quality_issues
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur     public.mk9_data_quality_issues%ROWTYPE;
  updated public.mk9_data_quality_issues%ROWTYPE;
  new_due timestamptz;
BEGIN
  SELECT * INTO cur FROM public.mk9_data_quality_issues WHERE id = _issue_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'MK9_DQ_NOT_FOUND'; END IF;
  PERFORM public.mk9_quality_check_version(cur.updated_at, _expected_updated_at);

  IF _priority IS NOT NULL AND NOT (_priority = ANY (ARRAY['LOW','NORMAL','HIGH','URGENT'])) THEN
    RAISE EXCEPTION 'MK9_DQ_INVALID_PRIORITY';
  END IF;

  new_due := CASE WHEN COALESCE(_clear_due, false) THEN NULL
                  WHEN _due_at IS NOT NULL THEN _due_at
                  ELSE cur.due_at END;

  UPDATE public.mk9_data_quality_issues SET
    priority = COALESCE(_priority, cur.priority),
    due_at   = new_due
  WHERE id = _issue_id
  RETURNING * INTO updated;

  IF _priority IS NOT NULL AND _priority IS DISTINCT FROM cur.priority THEN
    INSERT INTO public.mk9_data_quality_issue_events
      (issue_id, event_type, from_status, to_status, actor_id, reason, metadata)
    VALUES (_issue_id, 'PRIORITY_CHANGED', cur.status, cur.status, _actor_id, _reason,
            jsonb_build_object('from', cur.priority, 'to', _priority));
  END IF;

  IF new_due IS DISTINCT FROM cur.due_at THEN
    INSERT INTO public.mk9_data_quality_issue_events
      (issue_id, event_type, from_status, to_status, actor_id, reason, metadata)
    VALUES (_issue_id,
            CASE WHEN cur.due_at IS NULL THEN 'DUE_DATE_SET' ELSE 'DUE_DATE_CHANGED' END,
            cur.status, cur.status, _actor_id, _reason,
            jsonb_build_object('from', cur.due_at, 'to', new_due));
  END IF;

  RETURN updated;
END $$;

-- ------------------------------------------------------------
-- Transição v2 (resolução tipada, ignore com revisão, forçar)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_quality_transition_issue_v2(
  _issue_id uuid,
  _to_status text,
  _actor_id uuid,
  _reason text DEFAULT NULL,
  _resolution_type text DEFAULT NULL,
  _forced boolean DEFAULT false,
  _ignore_until timestamptz DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL
) RETURNS public.mk9_data_quality_issues
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur     public.mk9_data_quality_issues%ROWTYPE;
  updated public.mk9_data_quality_issues%ROWTYPE;
  ev      text;
BEGIN
  SELECT * INTO cur FROM public.mk9_data_quality_issues WHERE id = _issue_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'MK9_DQ_NOT_FOUND'; END IF;
  PERFORM public.mk9_quality_check_version(cur.updated_at, _expected_updated_at);

  IF _to_status NOT IN ('ACKNOWLEDGED','IN_PROGRESS','RESOLVED','IGNORED') THEN
    RAISE EXCEPTION 'MK9_DQ_INVALID_TRANSITION';
  END IF;
  IF _to_status = 'IGNORED' AND (_reason IS NULL OR length(btrim(_reason)) < 5) THEN
    RAISE EXCEPTION 'MK9_DQ_REASON_REQUIRED';
  END IF;
  IF _to_status = 'RESOLVED' THEN
    IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
      RAISE EXCEPTION 'MK9_DQ_REASON_REQUIRED';
    END IF;
    IF _resolution_type IS NULL THEN RAISE EXCEPTION 'MK9_DQ_RESOLUTION_TYPE_REQUIRED'; END IF;
    IF _resolution_type = 'OTHER' AND length(btrim(_reason)) < 20 THEN
      RAISE EXCEPTION 'MK9_DQ_RESOLUTION_DETAIL_REQUIRED';
    END IF;
  END IF;

  UPDATE public.mk9_data_quality_issues SET
    status            = _to_status,
    acknowledged_at   = CASE WHEN _to_status = 'ACKNOWLEDGED' AND acknowledged_at IS NULL THEN now() ELSE acknowledged_at END,
    acknowledged_by   = CASE WHEN _to_status = 'ACKNOWLEDGED' AND acknowledged_by IS NULL THEN _actor_id ELSE acknowledged_by END,
    started_at        = CASE WHEN _to_status = 'IN_PROGRESS' AND started_at IS NULL THEN now() ELSE started_at END,
    resolved_at       = CASE WHEN _to_status = 'RESOLVED' THEN now() ELSE resolved_at END,
    resolved_by       = CASE WHEN _to_status = 'RESOLVED' THEN _actor_id ELSE resolved_by END,
    resolution_note   = CASE WHEN _to_status = 'RESOLVED' THEN _reason ELSE resolution_note END,
    resolution_type   = CASE WHEN _to_status = 'RESOLVED' THEN _resolution_type ELSE resolution_type END,
    resolution_forced = CASE WHEN _to_status = 'RESOLVED' THEN COALESCE(_forced,false) ELSE resolution_forced END,
    ignored_at        = CASE WHEN _to_status = 'IGNORED' THEN now() ELSE ignored_at END,
    ignored_by        = CASE WHEN _to_status = 'IGNORED' THEN _actor_id ELSE ignored_by END,
    ignore_reason     = CASE WHEN _to_status = 'IGNORED' THEN _reason ELSE ignore_reason END,
    ignore_until      = CASE WHEN _to_status = 'IGNORED' THEN _ignore_until ELSE ignore_until END
  WHERE id = _issue_id
  RETURNING * INTO updated;

  ev := CASE _to_status
          WHEN 'ACKNOWLEDGED' THEN 'ACKNOWLEDGED'
          WHEN 'IN_PROGRESS'  THEN 'STARTED'
          WHEN 'RESOLVED'     THEN 'RESOLVED'
          ELSE 'IGNORED' END;

  INSERT INTO public.mk9_data_quality_issue_events
    (issue_id, event_type, from_status, to_status, actor_id, reason, metadata)
  VALUES (_issue_id, ev, cur.status, _to_status, _actor_id, _reason,
          jsonb_strip_nulls(jsonb_build_object(
            'resolution_type', _resolution_type,
            'forced', CASE WHEN COALESCE(_forced,false) THEN true ELSE NULL END,
            'ignore_until', _ignore_until)));

  RETURN updated;
END $$;

-- ------------------------------------------------------------
-- Reabertura manual
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_quality_reopen_issue(
  _issue_id uuid,
  _actor_id uuid,
  _reason text,
  _expected_updated_at timestamptz DEFAULT NULL
) RETURNS public.mk9_data_quality_issues
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur     public.mk9_data_quality_issues%ROWTYPE;
  updated public.mk9_data_quality_issues%ROWTYPE;
BEGIN
  SELECT * INTO cur FROM public.mk9_data_quality_issues WHERE id = _issue_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'MK9_DQ_NOT_FOUND'; END IF;
  PERFORM public.mk9_quality_check_version(cur.updated_at, _expected_updated_at);
  IF cur.status NOT IN ('RESOLVED','RESOLVED_AUTO','IGNORED') THEN
    RAISE EXCEPTION 'MK9_DQ_INVALID_TRANSITION';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'MK9_DQ_REASON_REQUIRED';
  END IF;

  UPDATE public.mk9_data_quality_issues SET
    status = 'REOPENED', reopened_at = now(),
    resolved_at = NULL, resolved_by = NULL, resolution_note = NULL,
    resolution_type = NULL, resolution_forced = false,
    ignored_at = NULL, ignored_by = NULL, ignore_reason = NULL, ignore_until = NULL,
    due_at = COALESCE(due_at, public.mk9_quality_default_due_at(severity, now()))
  WHERE id = _issue_id
  RETURNING * INTO updated;

  INSERT INTO public.mk9_data_quality_issue_events
    (issue_id, event_type, from_status, to_status, actor_id, reason, metadata)
  VALUES (_issue_id, 'REOPENED', cur.status, 'REOPENED', _actor_id, _reason,
          jsonb_strip_nulls(jsonb_build_object(
            'manual', true,
            'previous_assignee', cur.assigned_to_user_id,
            'previous_resolution_type', cur.resolution_type)));

  RETURN updated;
END $$;

-- ------------------------------------------------------------
-- Comentários (adicionar / editar / arquivar)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_quality_add_comment(
  _issue_id uuid, _author_id uuid, _body text, _visibility text
) RETURNS public.mk9_data_quality_issue_comments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.mk9_data_quality_issue_comments%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mk9_data_quality_issues WHERE id = _issue_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'MK9_DQ_NOT_FOUND';
  END IF;

  INSERT INTO public.mk9_data_quality_issue_comments (issue_id, author_id, body, visibility)
  VALUES (_issue_id, _author_id, btrim(_body), COALESCE(_visibility,'INTERNAL'))
  RETURNING * INTO row;

  UPDATE public.mk9_data_quality_issues SET last_comment_at = now() WHERE id = _issue_id;

  INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, actor_id, metadata)
  VALUES (_issue_id, 'COMMENT_ADDED', _author_id,
          jsonb_build_object('comment_id', row.id, 'visibility', row.visibility));

  RETURN row;
END $$;

CREATE OR REPLACE FUNCTION public.mk9_quality_edit_comment(
  _comment_id uuid, _actor_id uuid, _body text
) RETURNS public.mk9_data_quality_issue_comments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.mk9_data_quality_issue_comments%ROWTYPE;
BEGIN
  UPDATE public.mk9_data_quality_issue_comments
     SET body = btrim(_body)
   WHERE id = _comment_id AND archived_at IS NULL
  RETURNING * INTO row;
  IF NOT FOUND THEN RAISE EXCEPTION 'MK9_DQ_NOT_FOUND'; END IF;

  INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, actor_id, metadata)
  VALUES (row.issue_id, 'COMMENT_EDITED', _actor_id, jsonb_build_object('comment_id', row.id));

  RETURN row;
END $$;

CREATE OR REPLACE FUNCTION public.mk9_quality_archive_comment(
  _comment_id uuid, _actor_id uuid, _reason text DEFAULT NULL
) RETURNS public.mk9_data_quality_issue_comments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.mk9_data_quality_issue_comments%ROWTYPE;
BEGIN
  UPDATE public.mk9_data_quality_issue_comments
     SET archived_at = now()
   WHERE id = _comment_id AND archived_at IS NULL
  RETURNING * INTO row;
  IF NOT FOUND THEN RAISE EXCEPTION 'MK9_DQ_NOT_FOUND'; END IF;

  INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, actor_id, reason, metadata)
  VALUES (row.issue_id, 'COMMENT_ARCHIVED', _actor_id, _reason, jsonb_build_object('comment_id', row.id));

  RETURN row;
END $$;

-- ------------------------------------------------------------
-- Sincronização: prazo automático + reabertura por vencimento do ignore
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_quality_sync_detections(
  _source text, _issue_types text[], _detections jsonb,
  _competence_month integer DEFAULT NULL, _competence_year integer DEFAULT NULL)
RETURNS TABLE(created integer, seen integer, reopened integer, auto_resolved integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  d              jsonb;
  existing       public.mk9_data_quality_issues%ROWTYPE;
  new_id         uuid;
  next_status    text;
  ctx_changed    boolean;
  ignore_expired boolean;
  fingerprints   text[] := ARRAY[]::text[];
  c_created      int := 0;
  c_seen         int := 0;
  c_reopened     int := 0;
  c_auto         int := 0;
BEGIN
  IF _source IS NULL OR btrim(_source) = '' THEN
    RAISE EXCEPTION 'MK9_DQ_INVALID_SOURCE';
  END IF;
  IF _issue_types IS NULL OR array_length(_issue_types, 1) IS NULL THEN
    RAISE EXCEPTION 'MK9_DQ_INVALID_SCOPE';
  END IF;

  FOR d IN SELECT * FROM jsonb_array_elements(COALESCE(_detections, '[]'::jsonb))
  LOOP
    IF NOT (d->>'issue_type' = ANY(_issue_types)) THEN
      RAISE EXCEPTION 'MK9_DQ_TYPE_OUT_OF_SCOPE';
    END IF;

    fingerprints := fingerprints || (d->>'fingerprint');

    SELECT * INTO existing
      FROM public.mk9_data_quality_issues
     WHERE fingerprint = (d->>'fingerprint') AND archived_at IS NULL
     LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO public.mk9_data_quality_issues (
        category, issue_type, severity, status, entity_type, entity_id, peer_entity_id,
        industry_id, store_id, promoter_id, supervisor_id, import_id,
        competence_month, competence_year, title, description, evidence,
        suggested_action, source, fingerprint, context_hash, due_at
      ) VALUES (
        d->>'category', d->>'issue_type', d->>'severity', 'OPEN',
        d->>'entity_type',
        NULLIF(d->>'entity_id','')::uuid, NULLIF(d->>'peer_entity_id','')::uuid,
        NULLIF(d->>'industry_id','')::uuid, NULLIF(d->>'store_id','')::uuid,
        NULLIF(d->>'promoter_id','')::uuid, NULLIF(d->>'supervisor_id','')::uuid,
        NULLIF(d->>'import_id','')::uuid,
        NULLIF(d->>'competence_month','')::int, NULLIF(d->>'competence_year','')::int,
        d->>'title', d->>'description', COALESCE(d->'evidence', '{}'::jsonb),
        d->>'suggested_action', _source, d->>'fingerprint', d->>'context_hash',
        public.mk9_quality_default_due_at(d->>'severity', now())
      ) RETURNING id INTO new_id;

      INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, to_status, metadata)
      VALUES (new_id, 'DETECTED', 'OPEN', jsonb_build_object('source', _source));
      c_created := c_created + 1;

    ELSE
      next_status := existing.status;
      ctx_changed := existing.context_hash IS DISTINCT FROM (d->>'context_hash');
      ignore_expired := existing.status = 'IGNORED'
                        AND existing.ignore_until IS NOT NULL
                        AND existing.ignore_until <= now();

      IF existing.status IN ('RESOLVED','RESOLVED_AUTO') THEN
        next_status := 'REOPENED';
      ELSIF existing.status = 'IGNORED' AND (ctx_changed OR ignore_expired) THEN
        next_status := 'REOPENED';
      END IF;

      UPDATE public.mk9_data_quality_issues SET
        status         = next_status,
        severity       = d->>'severity',
        title          = d->>'title',
        description    = d->>'description',
        evidence       = COALESCE(d->'evidence', '{}'::jsonb),
        suggested_action = d->>'suggested_action',
        context_hash   = d->>'context_hash',
        last_seen_at   = now(),
        reopened_at    = CASE WHEN next_status = 'REOPENED' AND existing.status <> 'REOPENED'
                              THEN now() ELSE reopened_at END,
        due_at         = CASE WHEN next_status = 'REOPENED' AND existing.status <> 'REOPENED'
                              THEN COALESCE(due_at, public.mk9_quality_default_due_at(d->>'severity', now()))
                              ELSE due_at END,
        resolved_at    = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE resolved_at END,
        resolved_by    = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE resolved_by END,
        resolution_note= CASE WHEN next_status = 'REOPENED' THEN NULL ELSE resolution_note END,
        resolution_type= CASE WHEN next_status = 'REOPENED' THEN NULL ELSE resolution_type END,
        resolution_forced = CASE WHEN next_status = 'REOPENED' THEN false ELSE resolution_forced END,
        ignored_at     = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE ignored_at END,
        ignored_by     = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE ignored_by END,
        ignore_reason  = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE ignore_reason END,
        ignore_until   = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE ignore_until END
      WHERE id = existing.id;

      IF next_status = 'REOPENED' AND existing.status <> 'REOPENED' THEN
        INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, from_status, to_status, metadata)
        VALUES (existing.id, 'REOPENED', existing.status, 'REOPENED',
                jsonb_build_object('context_changed', ctx_changed,
                                   'ignore_expired', COALESCE(ignore_expired,false),
                                   'previous_assignee', existing.assigned_to_user_id));
        c_reopened := c_reopened + 1;
      ELSIF ctx_changed THEN
        INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, from_status, to_status, metadata)
        VALUES (existing.id, 'EVIDENCE_UPDATED', existing.status, next_status, '{}'::jsonb);
        c_seen := c_seen + 1;
      ELSE
        INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, from_status, to_status, metadata)
        VALUES (existing.id, 'SEEN_AGAIN', existing.status, next_status, '{}'::jsonb);
        c_seen := c_seen + 1;
      END IF;
    END IF;
  END LOOP;

  WITH gone AS (
    UPDATE public.mk9_data_quality_issues i
       SET status = 'RESOLVED_AUTO', resolved_at = now(), resolved_by = NULL
     WHERE i.archived_at IS NULL
       AND i.source = _source
       AND i.issue_type = ANY(_issue_types)
       AND (_competence_year  IS NULL OR i.competence_year  IS NOT DISTINCT FROM _competence_year)
       AND (_competence_month IS NULL OR i.competence_month IS NOT DISTINCT FROM _competence_month)
       AND i.status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','REOPENED')
       AND NOT (i.fingerprint = ANY(fingerprints))
    RETURNING i.id, i.status
  ), ev AS (
    INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, to_status, metadata)
    SELECT g.id, 'RESOLVED_AUTO', 'RESOLVED_AUTO', jsonb_build_object('source', _source) FROM gone g
    RETURNING 1
  )
  SELECT count(*)::int INTO c_auto FROM ev;

  RETURN QUERY SELECT c_created, c_seen, c_reopened, c_auto;
END;
$function$;

REVOKE ALL ON FUNCTION public.mk9_quality_assign_issue(uuid,uuid,uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_quality_set_planning(uuid,text,timestamptz,boolean,uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_quality_transition_issue_v2(uuid,text,uuid,text,text,boolean,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_quality_reopen_issue(uuid,uuid,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_quality_add_comment(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_quality_edit_comment(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mk9_quality_archive_comment(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_quality_assign_issue(uuid,uuid,uuid,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_quality_set_planning(uuid,text,timestamptz,boolean,uuid,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_quality_transition_issue_v2(uuid,text,uuid,text,text,boolean,timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_quality_reopen_issue(uuid,uuid,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_quality_add_comment(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_quality_edit_comment(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mk9_quality_archive_comment(uuid,uuid,text) TO service_role;