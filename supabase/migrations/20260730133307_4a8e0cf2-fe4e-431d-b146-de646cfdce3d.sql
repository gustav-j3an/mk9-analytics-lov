-- =====================================================================
-- MK9 — FASE 2B.1: Centro de Qualidade dos Dados (modelo + motor base)
-- =====================================================================

-- 1) TABELA DE OCORRÊNCIAS -------------------------------------------
CREATE TABLE IF NOT EXISTS public.mk9_data_quality_issues (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category           text NOT NULL,
  issue_type         text NOT NULL,
  severity           text NOT NULL,
  status             text NOT NULL DEFAULT 'OPEN',
  entity_type        text NOT NULL,
  entity_id          uuid,
  peer_entity_id     uuid,
  industry_id        uuid REFERENCES public.mk9_industries(id) ON DELETE SET NULL,
  store_id           uuid REFERENCES public.mk9_stores(id) ON DELETE SET NULL,
  promoter_id        uuid REFERENCES public.mk9_promoters(id) ON DELETE SET NULL,
  supervisor_id      uuid,
  import_id          uuid,
  competence_month   integer,
  competence_year    integer,
  title              text NOT NULL,
  description        text NOT NULL,
  evidence           jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_action   text,
  source             text NOT NULL,
  fingerprint        text NOT NULL,
  context_hash       text NOT NULL,
  first_detected_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  acknowledged_at    timestamptz,
  acknowledged_by    uuid,
  resolved_at        timestamptz,
  resolved_by        uuid,
  resolution_note    text,
  ignored_at         timestamptz,
  ignored_by         uuid,
  ignore_reason      text,
  reopened_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  archived_at        timestamptz
);

ALTER TABLE public.mk9_data_quality_issues
  DROP CONSTRAINT IF EXISTS mk9_dq_category_chk,
  DROP CONSTRAINT IF EXISTS mk9_dq_severity_chk,
  DROP CONSTRAINT IF EXISTS mk9_dq_status_chk,
  DROP CONSTRAINT IF EXISTS mk9_dq_month_chk,
  DROP CONSTRAINT IF EXISTS mk9_dq_year_chk,
  DROP CONSTRAINT IF EXISTS mk9_dq_ignore_reason_chk,
  DROP CONSTRAINT IF EXISTS mk9_dq_resolution_note_chk,
  DROP CONSTRAINT IF EXISTS mk9_dq_fingerprint_chk,
  DROP CONSTRAINT IF EXISTS mk9_dq_context_hash_chk;

ALTER TABLE public.mk9_data_quality_issues
  ADD CONSTRAINT mk9_dq_category_chk CHECK (
    category IN ('CADASTRO','FREQUENCIA','ROTEIRO','VISITA','IMPORTACAO','INTEGRIDADE','SEGURANCA')),
  ADD CONSTRAINT mk9_dq_severity_chk CHECK (
    severity IN ('INFO','AVISO','ATENCAO','CRITICO','BLOQUEANTE')),
  ADD CONSTRAINT mk9_dq_status_chk CHECK (
    status IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','RESOLVED_AUTO','IGNORED','REOPENED')),
  ADD CONSTRAINT mk9_dq_month_chk CHECK (
    competence_month IS NULL OR (competence_month BETWEEN 1 AND 12)),
  ADD CONSTRAINT mk9_dq_year_chk CHECK (
    competence_year IS NULL OR (competence_year BETWEEN 2000 AND 2100)),
  ADD CONSTRAINT mk9_dq_ignore_reason_chk CHECK (
    status <> 'IGNORED' OR (ignore_reason IS NOT NULL AND length(btrim(ignore_reason)) >= 5)),
  ADD CONSTRAINT mk9_dq_resolution_note_chk CHECK (
    status <> 'RESOLVED' OR (resolution_note IS NOT NULL AND length(btrim(resolution_note)) >= 3)),
  ADD CONSTRAINT mk9_dq_fingerprint_chk CHECK (length(btrim(fingerprint)) > 0),
  ADD CONSTRAINT mk9_dq_context_hash_chk CHECK (length(btrim(context_hash)) > 0);

-- Identidade lógica: uma ocorrência ATIVA (não arquivada) por fingerprint.
-- O histórico completo vive em mk9_data_quality_issue_events.
CREATE UNIQUE INDEX IF NOT EXISTS mk9_dq_fingerprint_active_uidx
  ON public.mk9_data_quality_issues (fingerprint)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS mk9_dq_status_idx      ON public.mk9_data_quality_issues (status)      WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS mk9_dq_severity_idx    ON public.mk9_data_quality_issues (severity)    WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS mk9_dq_category_idx    ON public.mk9_data_quality_issues (category)    WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS mk9_dq_industry_idx    ON public.mk9_data_quality_issues (industry_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS mk9_dq_store_idx       ON public.mk9_data_quality_issues (store_id)    WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS mk9_dq_competence_idx  ON public.mk9_data_quality_issues (competence_year, competence_month);
CREATE INDEX IF NOT EXISTS mk9_dq_last_seen_idx   ON public.mk9_data_quality_issues (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS mk9_dq_overview_idx    ON public.mk9_data_quality_issues (category, severity, status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS mk9_dq_source_type_idx ON public.mk9_data_quality_issues (source, issue_type)         WHERE archived_at IS NULL;

-- 2) HISTÓRICO DE EVENTOS ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.mk9_data_quality_issue_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    uuid NOT NULL REFERENCES public.mk9_data_quality_issues(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  from_status text,
  to_status   text,
  actor_id    uuid,
  reason      text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mk9_data_quality_issue_events
  DROP CONSTRAINT IF EXISTS mk9_dq_event_type_chk;
ALTER TABLE public.mk9_data_quality_issue_events
  ADD CONSTRAINT mk9_dq_event_type_chk CHECK (event_type IN (
    'DETECTED','SEEN_AGAIN','ACKNOWLEDGED','STARTED','RESOLVED',
    'RESOLVED_AUTO','IGNORED','REOPENED','EVIDENCE_UPDATED'));

CREATE INDEX IF NOT EXISTS mk9_dq_events_issue_idx
  ON public.mk9_data_quality_issue_events (issue_id, created_at DESC);

-- 3) updated_at ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mk9_dq_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS mk9_dq_issues_touch ON public.mk9_data_quality_issues;
CREATE TRIGGER mk9_dq_issues_touch
BEFORE UPDATE ON public.mk9_data_quality_issues
FOR EACH ROW EXECUTE FUNCTION public.mk9_dq_touch_updated_at();

-- 4) GRANTS -------------------------------------------------------------
-- Leitura pelo usuário autenticado (filtrada por RLS). Escrita só service_role.
GRANT SELECT ON public.mk9_data_quality_issues        TO authenticated;
GRANT SELECT ON public.mk9_data_quality_issue_events  TO authenticated;
GRANT ALL    ON public.mk9_data_quality_issues        TO service_role;
GRANT ALL    ON public.mk9_data_quality_issue_events  TO service_role;
REVOKE ALL   ON public.mk9_data_quality_issues        FROM anon;
REVOKE ALL   ON public.mk9_data_quality_issue_events  FROM anon;

-- 5) RLS ----------------------------------------------------------------
ALTER TABLE public.mk9_data_quality_issues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mk9_data_quality_issue_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mk9_dq_issues_select ON public.mk9_data_quality_issues;
CREATE POLICY mk9_dq_issues_select
  ON public.mk9_data_quality_issues
  FOR SELECT TO authenticated
  USING (
    public.is_mk9_admin()
    OR public.has_mk9_role(auth.uid(), 'AUDITOR'::mk9_role)
    OR (
      public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role)
      AND (industry_id IS NULL OR public.mk9_visible_industry(industry_id))
    )
    OR (
      public.has_mk9_role(auth.uid(), 'CLIENTE'::mk9_role)
      AND category IN ('CADASTRO','FREQUENCIA','ROTEIRO','VISITA')
      AND industry_id IS NOT NULL
      AND public.mk9_visible_industry(industry_id)
    )
    OR (
      public.has_mk9_role(auth.uid(), 'PROMOTOR'::mk9_role)
      AND category IN ('ROTEIRO','VISITA')
      AND promoter_id IS NOT NULL
      AND public.user_has_mk9_scope('PROMOTER', promoter_id::text)
    )
  );

-- Eventos: visíveis apenas para quem pode ver a ocorrência, e nunca para CLIENTE
-- (podem conter justificativas administrativas internas).
DROP POLICY IF EXISTS mk9_dq_events_select ON public.mk9_data_quality_issue_events;
CREATE POLICY mk9_dq_events_select
  ON public.mk9_data_quality_issue_events
  FOR SELECT TO authenticated
  USING (
    (public.is_mk9_admin()
     OR public.has_mk9_role(auth.uid(), 'AUDITOR'::mk9_role)
     OR public.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role))
    AND EXISTS (
      SELECT 1 FROM public.mk9_data_quality_issues i
       WHERE i.id = issue_id
         AND (i.industry_id IS NULL OR public.mk9_visible_industry(i.industry_id))
    )
  );

-- Sem policies de INSERT/UPDATE/DELETE para authenticated: toda escrita passa
-- pelas RPCs SECURITY DEFINER abaixo ou pelo service_role no servidor.

-- 6) RPC: sincronização de detecções (transacional) ----------------------
CREATE OR REPLACE FUNCTION public.mk9_quality_sync_detections(
  _source           text,
  _issue_types      text[],
  _detections       jsonb,
  _competence_month integer DEFAULT NULL,
  _competence_year  integer DEFAULT NULL
)
RETURNS TABLE (created int, seen int, reopened int, auto_resolved int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d              jsonb;
  existing       public.mk9_data_quality_issues%ROWTYPE;
  new_id         uuid;
  next_status    text;
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
        suggested_action, source, fingerprint, context_hash
      ) VALUES (
        d->>'category', d->>'issue_type', d->>'severity', 'OPEN',
        d->>'entity_type',
        NULLIF(d->>'entity_id','')::uuid, NULLIF(d->>'peer_entity_id','')::uuid,
        NULLIF(d->>'industry_id','')::uuid, NULLIF(d->>'store_id','')::uuid,
        NULLIF(d->>'promoter_id','')::uuid, NULLIF(d->>'supervisor_id','')::uuid,
        NULLIF(d->>'import_id','')::uuid,
        NULLIF(d->>'competence_month','')::int, NULLIF(d->>'competence_year','')::int,
        d->>'title', d->>'description', COALESCE(d->'evidence', '{}'::jsonb),
        d->>'suggested_action', _source, d->>'fingerprint', d->>'context_hash'
      ) RETURNING id INTO new_id;

      INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, to_status, metadata)
      VALUES (new_id, 'DETECTED', 'OPEN', jsonb_build_object('source', _source));
      c_created := c_created + 1;

    ELSE
      next_status := existing.status;

      IF existing.status IN ('RESOLVED','RESOLVED_AUTO') THEN
        next_status := 'REOPENED';
      ELSIF existing.status = 'IGNORED' THEN
        -- Só reabre quando o CONTEXTO mudou (mesmo contexto = decisão preservada).
        IF existing.context_hash IS DISTINCT FROM (d->>'context_hash') THEN
          next_status := 'REOPENED';
        END IF;
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
        resolved_at    = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE resolved_at END,
        resolved_by    = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE resolved_by END,
        resolution_note= CASE WHEN next_status = 'REOPENED' THEN NULL ELSE resolution_note END,
        ignored_at     = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE ignored_at END,
        ignored_by     = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE ignored_by END,
        ignore_reason  = CASE WHEN next_status = 'REOPENED' THEN NULL ELSE ignore_reason END
      WHERE id = existing.id;

      IF next_status = 'REOPENED' AND existing.status <> 'REOPENED' THEN
        INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, from_status, to_status, metadata)
        VALUES (existing.id, 'REOPENED', existing.status, 'REOPENED',
                jsonb_build_object('context_changed', existing.context_hash IS DISTINCT FROM (d->>'context_hash')));
        c_reopened := c_reopened + 1;
      ELSIF existing.context_hash IS DISTINCT FROM (d->>'context_hash') THEN
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

  -- Auto-resolução: ativas do mesmo escopo que não foram detectadas agora.
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
$$;

REVOKE ALL ON FUNCTION public.mk9_quality_sync_detections(text, text[], jsonb, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_quality_sync_detections(text, text[], jsonb, integer, integer) TO service_role;

-- 7) RPC: transição de status (transacional + evento obrigatório) --------
CREATE OR REPLACE FUNCTION public.mk9_quality_transition_issue(
  _issue_id  uuid,
  _to_status text,
  _actor_id  uuid,
  _reason    text DEFAULT NULL
)
RETURNS public.mk9_data_quality_issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur     public.mk9_data_quality_issues%ROWTYPE;
  updated public.mk9_data_quality_issues%ROWTYPE;
  ev      text;
BEGIN
  SELECT * INTO cur FROM public.mk9_data_quality_issues
   WHERE id = _issue_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'MK9_DQ_NOT_FOUND'; END IF;

  IF _to_status NOT IN ('ACKNOWLEDGED','IN_PROGRESS','RESOLVED','IGNORED') THEN
    RAISE EXCEPTION 'MK9_DQ_INVALID_TRANSITION';
  END IF;
  IF _to_status = 'IGNORED' AND (_reason IS NULL OR length(btrim(_reason)) < 5) THEN
    RAISE EXCEPTION 'MK9_DQ_REASON_REQUIRED';
  END IF;
  IF _to_status = 'RESOLVED' AND (_reason IS NULL OR length(btrim(_reason)) < 3) THEN
    RAISE EXCEPTION 'MK9_DQ_REASON_REQUIRED';
  END IF;

  UPDATE public.mk9_data_quality_issues SET
    status          = _to_status,
    acknowledged_at = CASE WHEN _to_status = 'ACKNOWLEDGED' THEN now() ELSE acknowledged_at END,
    acknowledged_by = CASE WHEN _to_status = 'ACKNOWLEDGED' THEN _actor_id ELSE acknowledged_by END,
    resolved_at     = CASE WHEN _to_status = 'RESOLVED' THEN now() ELSE resolved_at END,
    resolved_by     = CASE WHEN _to_status = 'RESOLVED' THEN _actor_id ELSE resolved_by END,
    resolution_note = CASE WHEN _to_status = 'RESOLVED' THEN _reason ELSE resolution_note END,
    ignored_at      = CASE WHEN _to_status = 'IGNORED' THEN now() ELSE ignored_at END,
    ignored_by      = CASE WHEN _to_status = 'IGNORED' THEN _actor_id ELSE ignored_by END,
    ignore_reason   = CASE WHEN _to_status = 'IGNORED' THEN _reason ELSE ignore_reason END
  WHERE id = _issue_id
  RETURNING * INTO updated;

  ev := CASE _to_status
          WHEN 'ACKNOWLEDGED' THEN 'ACKNOWLEDGED'
          WHEN 'IN_PROGRESS'  THEN 'STARTED'
          WHEN 'RESOLVED'     THEN 'RESOLVED'
          ELSE 'IGNORED' END;

  INSERT INTO public.mk9_data_quality_issue_events (issue_id, event_type, from_status, to_status, actor_id, reason)
  VALUES (_issue_id, ev, cur.status, _to_status, _actor_id, _reason);

  RETURN updated;
END;
$$;

REVOKE ALL ON FUNCTION public.mk9_quality_transition_issue(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_quality_transition_issue(uuid, text, uuid, text) TO service_role;