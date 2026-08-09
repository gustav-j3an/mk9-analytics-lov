import { supabaseAdmin } from "@/integrations/supabase/client.server";
/**
 * Função central para promover uma importação de checklist a operacional.
 * Garante atomicidade, versionamento e integridade dos dados.
 */
export async function promoteChecklistImportToOperational(importId) {
    console.log(`[PROMOTION] Iniciando promoção da importação ${importId} para operacional...`);
    // 1. Validar importação e obter metadados
    const { data: importRec, error: importError } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .select("id, industry_id, operation_month, operation_year, status, preview")
        .eq("id", importId)
        .single();
    if (importError || !importRec) {
        throw new Error(`Importação ${importId} não encontrada.`);
    }
    // Só podemos promover importações que não falharam.
    // REGRA MK9 (v1.3.9): 'committing' é aceito porque o commit chama a promoção
    // ANTES de mudar o status final (done/inconsistent), garantindo atomicidade visual.
    const successStatuses = ["done", "INCONSISTENT", "COMPLETED_WITH_ALERTS", "committing"];
    if (!successStatuses.includes(importRec.status)) {
        throw new Error(`Importação ${importId} está com status '${importRec.status}' e não pode ser promovida.`);
    }
    const { industry_id, operation_month, operation_year } = importRec;
    // 2. Localizar importação anterior para substituir (se houver)
    const { data: previous } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .select("id")
        .eq("industry_id", industry_id)
        .eq("operation_month", operation_month)
        .eq("operation_year", operation_year)
        .eq("is_operational_current", true)
        .neq("id", importId)
        .maybeSingle();
    // 3. DESATIVAR versões operacionais anteriores da mesma indústria/competência
    const { error: deactivateError } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .update({
        is_operational_current: false,
        superseded_at: new Date().toISOString(),
        superseded_by: importId,
    })
        .eq("industry_id", industry_id)
        .eq("operation_month", operation_month)
        .eq("operation_year", operation_year)
        .neq("id", importId);
    if (deactivateError) {
        throw new Error(`Erro ao desativar versões anteriores: ${deactivateError.message}`);
    }
    // 4. Se havia uma versão anterior, opcionalmente limpamos as visitas vinculadas a ela 
    if (previous) {
        await supabaseAdmin
            .from("mk9_actual_visits")
            .delete()
            .eq("source_import_id", previous.id);
    }
    // 5. ATIVAR a nova importação
    const { error: activateError } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .update({
        is_operational_current: true,
        replaces_import_id: previous?.id ?? null,
    })
        .eq("id", importId);
    if (activateError) {
        throw new Error(`Erro ao ativar a nova importação: ${activateError.message}`);
    }
    // 6. GARANTIR VÍNCULO DAS FREQUÊNCIAS VERSIONADAS
    const competencyStart = `${operation_year}-${String(operation_month).padStart(2, "0")}-01`;
    console.log(`[PROMOTION] Vinculando frequências de ${industry_id} para competência ${competencyStart}...`);
    const { error: freqUpdateError } = await supabaseAdmin
        .from("mk9_industry_store_frequency_versions")
        .update({ source_import_id: importId })
        .eq("industry_id", industry_id)
        .eq("valid_from", competencyStart)
        .is("archived_at", null);
    if (freqUpdateError) {
        console.warn(`[PROMOTION-WARN] Falha ao vincular frequências: ${freqUpdateError.message}`);
    }
    else {
        console.log(`[PROMOTION] Frequências vinculadas com sucesso.`);
    }
    console.log(`[PROMOTION] Importação ${importId} promovida com sucesso.`);
    return {
        success: true,
        importId,
        industryId: industry_id,
        previousImportId: previous?.id ?? null
    };
}
/**
 * Função administrativa para reprocessar a promoção operacional de uma importação.
 * Usada para recuperação de bugs como o da BANANA CORRENTE.
 */
export async function reprocessOperationalPromotion(importId) {
    try {
        return await promoteChecklistImportToOperational(importId);
    }
    catch (e) {
        console.error(`[REPROCESS-ERROR] ${importId}:`, e);
        return { success: false, error: e.message };
    }
}
