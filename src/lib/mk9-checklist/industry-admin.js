/**
 * MK9 — Regras puras da gestão administrativa de indústrias no fluxo de checklist.
 *
 * Nada aqui faz I/O: são as regras que o servidor aplica e que os testes cobrem.
 * O que este módulo decide:
 *  - códigos de erro padronizados;
 *  - quem pode habilitar/desabilitar (somente ADMIN);
 *  - regra temporal de cobrança (checklist_enabled_at);
 *  - candidatos semelhantes antes de criar indústria nova;
 *  - textos de confirmação/aviso usados pela interface.
 */
import { diceCoefficient } from "./similarity";
import { normalizeName } from "@/lib/mk9/normalization";
export const MK9_INDUSTRY_ERRORS = {
    UNAUTHENTICATED: "UNAUTHENTICATED",
    FORBIDDEN: "FORBIDDEN",
    INDUSTRY_NOT_FOUND: "INDUSTRY_NOT_FOUND",
    INDUSTRY_CHECKLIST_DISABLED: "INDUSTRY_CHECKLIST_DISABLED",
    INDUSTRY_ALREADY_ENABLED: "INDUSTRY_ALREADY_ENABLED",
    DUPLICATE_INDUSTRY: "DUPLICATE_INDUSTRY",
};
const ERROR_MESSAGES = {
    UNAUTHENTICATED: "Autenticação obrigatória. Faça login para continuar.",
    FORBIDDEN: "Esta indústria não está habilitada para checklist. Solicite a um administrador.",
    INDUSTRY_NOT_FOUND: "Indústria não encontrada.",
    INDUSTRY_CHECKLIST_DISABLED: "Esta indústria não está habilitada para checklist.",
    INDUSTRY_ALREADY_ENABLED: "Esta indústria já está habilitada para checklist.",
    DUPLICATE_INDUSTRY: "Já existe uma indústria cadastrada com este nome.",
};
export function mk9IndustryError(code, statusCode = 422) {
    const err = new Error(ERROR_MESSAGES[code]);
    err.name = code;
    err.code = code;
    err.statusCode = statusCode;
    return err;
}
export const DISABLE_CONFIRMATION_MESSAGE = "Esta indústria deixará de aparecer para novas importações de checklist. " +
    "Checklists, visitas, frequências, roteiros, relatórios e histórico existentes serão preservados.";
export const MISSING_PERIOD_WARNING = "Esta indústria usará o mês civil até que um período personalizado seja configurado.";
export const NON_ADMIN_DISABLED_MESSAGE = "Esta indústria não está habilitada para checklist. Solicite a um administrador.";
/** Somente ADMIN altera a classificação — inclusive no fluxo "Habilitar e continuar". */
export function canManageChecklistIndustries(roles) {
    return Array.isArray(roles) && roles.includes("ADMIN");
}
export function competenceKey(c) {
    return c.year * 12 + (c.month - 1);
}
/** Competência (mês/ano) em que a habilitação ocorreu, em UTC. */
export function enabledCompetence(enabledAt) {
    if (!enabledAt)
        return null;
    const d = enabledAt instanceof Date ? enabledAt : new Date(enabledAt);
    if (Number.isNaN(d.getTime()))
        return null;
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}
/**
 * A indústria só é cobrada por ausência de checklist se:
 *  - exige checklist; e
 *  - a competência analisada é igual ou posterior à competência de habilitação.
 */
export function isChecklistChargeable(industry, competence) {
    if (!industry.requiresChecklist)
        return false;
    const enabled = enabledCompetence(industry.checklistEnabledAt ?? null);
    if (!enabled)
        return true; // sem data registrada: comportamento anterior preservado
    return competenceKey(competence) >= competenceKey(enabled);
}
export const SIMILARITY_THRESHOLD = 0.6;
/** Indústrias parecidas que devem ser mostradas ANTES de criar uma nova. */
export function findSimilarIndustries(name, existing, threshold = SIMILARITY_THRESHOLD) {
    const norm = normalizeName(name);
    if (!norm)
        return [];
    return existing
        .map((i) => ({ ...i, score: diceCoefficient(norm, i.nameNormalized) }))
        .filter((i) => (i.score ?? 0) >= threshold)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 5);
}
/** Duplicidade é sempre por nome normalizado — nunca pelo texto digitado. */
export function findExactIndustry(name, existing) {
    const norm = normalizeName(name);
    return existing.find((i) => i.nameNormalized === norm) ?? null;
}
export function decideIndustryCreation(name, existing, opts) {
    const trimmed = (name ?? "").trim();
    const norm = normalizeName(trimmed);
    const exact = findExactIndustry(trimmed, existing);
    if (exact)
        return { kind: "duplicate", match: exact };
    const candidates = findSimilarIndustries(trimmed, existing);
    if (candidates.length && !opts?.confirmed)
        return { kind: "needs_confirmation", candidates };
    return { kind: "create", name: trimmed, nameNormalized: norm };
}
// ---------------------------------------------------------------------------
// Caches invalidados após habilitar/desabilitar (contrato compartilhado UI ⇄ testes)
// ---------------------------------------------------------------------------
export const CHECKLIST_INDUSTRY_CACHE_KEYS = [
    "mk9-industries",
    "mk9-checklist-industries",
    "mk9-checklist-imports",
    "mk9-cockpit",
    "mk9-dashboard",
    "mk9-quality",
];
