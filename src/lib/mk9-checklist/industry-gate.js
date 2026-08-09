/**
 * MK9 — Classificação "exige checklist".
 *
 * Regra pura (testável, sem I/O): somente indústrias com requires_checklist = true
 * participam do fluxo operacional de checklist (seleção, upload, prévia, commit).
 * O campo NÃO significa indústria inativa: roteiro, frequência, visitas, auditoria
 * e relatórios continuam valendo normalmente.
 */
import { isChecklistChargeable } from "./industry-admin";
export const INDUSTRY_CHECKLIST_DISABLED = "INDUSTRY_CHECKLIST_DISABLED";
export const INDUSTRY_CHECKLIST_DISABLED_MESSAGE = "Esta indústria não está habilitada para importação de checklist.";
export function isChecklistIndustryAllowed(industry) {
    return !!industry && industry.requiresChecklist === true;
}
/** Erro controlado, sem SQL/policy/detalhe interno. */
export function checklistIndustryDisabledError() {
    const err = new Error(INDUSTRY_CHECKLIST_DISABLED_MESSAGE);
    err.name = INDUSTRY_CHECKLIST_DISABLED;
    err.code = INDUSTRY_CHECKLIST_DISABLED;
    err.statusCode = 422;
    return err;
}
/** Mantém apenas as indústrias habilitadas ao fluxo de checklist. */
export function filterChecklistIndustries(list) {
    return list.filter((i) => isChecklistIndustryAllowed(i));
}
/**
 * Contagem de "indústrias sem checklist na competência".
 * Considera SOMENTE indústrias que exigem checklist E cuja habilitação já valia
 * na competência analisada (regra temporal: nada de cobrança retroativa).
 */
export function countIndustriesMissingChecklist(ctxs, competence) {
    return ctxs.filter((c) => {
        if (c.checklistImports !== 0)
            return false;
        if (!competence)
            return c.requiresChecklist === true;
        return isChecklistChargeable(c, competence);
    }).length;
}
