CREATE OR REPLACE FUNCTION public.mk9_approve_visit_evidence(
    p_evidence_id UUID,
    p_reviewer_id UUID,
    p_now TIMESTAMPTZ
) RETURNS JSON AS $$
DECLARE
    v_evidence RECORD;
    v_captured_date DATE;
    v_actual_visit_id UUID;
BEGIN
    -- 1. Lock e Validação da Evidência
    SELECT * INTO v_evidence
    FROM public.mk9_visit_evidence
    WHERE id = p_evidence_id AND status = 'PENDING'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'EVIDENCIA_NAO_ENCONTRADA_OU_JA_PROCESSADA';
    END IF;

    -- 2. Determinar Data (Captured At)
    v_captured_date := v_evidence.captured_at::DATE;

    -- 3. Conciliação Cross-Origin: Tentar localizar visita existente (mesma indústria/loja/data)
    SELECT id INTO v_actual_visit_id
    FROM public.mk9_actual_visits
    WHERE industry_id = v_evidence.industry_id
      AND store_id = v_evidence.store_id
      AND scheduled_date = v_captured_date
    LIMIT 1;

    IF v_actual_visit_id IS NOT NULL THEN
        -- Visita já existe. Vincular evidence_id.
        UPDATE public.mk9_actual_visits
        SET evidence_id = v_evidence.id
        WHERE id = v_actual_visit_id 
          AND (evidence_id IS NULL OR evidence_id = v_evidence.id);
    ELSE
        -- 4. Criar Actual Visit (Portal)
        INSERT INTO public.mk9_actual_visits (
            industry_id, store_id, promoter_id, scheduled_date, 
            origin, evidence_id, status
        ) VALUES (
            v_evidence.industry_id, v_evidence.store_id, v_evidence.promoter_id, v_captured_date,
            'PORTAL', v_evidence.id, 'completed'
        ) RETURNING id INTO v_actual_visit_id;
    END IF;

    -- 5. Atualizar status da evidência
    UPDATE public.mk9_visit_evidence
    SET 
        status = 'APPROVED',
        reviewed_by = p_reviewer_id,
        reviewed_at = p_now,
        updated_at = p_now
    WHERE id = v_evidence.id;

    RETURN json_build_object('success', true, 'visit_id', v_actual_visit_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mk9_approve_visit_evidence(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mk9_approve_visit_evidence(UUID, UUID, TIMESTAMPTZ) TO service_role;