/**
 * MK9 — Utilitários de normalização e validação de papéis (roles).
 * Este arquivo é seguro para importação em Client e Server (não usa Node/Browser APIs).
 */
const VALID_ROLES = new Set(["ADMIN", "SUPERVISOR", "PROMOTOR", "CLIENTE", "AUDITOR"]);
/**
 * Normaliza uma role para caixa alta e valida se pertence aos valores permitidos.
 * Retorna null se for inválida ou ausente.
 */
export function normalizeMk9Role(role) {
    if (typeof role !== "string")
        return null;
    const normalized = role.trim().toUpperCase();
    return VALID_ROLES.has(normalized) ? normalized : null;
}
/**
 * Filtra e normaliza uma lista de roles, removendo duplicatas e valores inválidos.
 */
export function normalizeMk9Roles(roles) {
    if (!Array.isArray(roles))
        return [];
    const result = new Set();
    for (const r of roles) {
        const normalized = normalizeMk9Role(r);
        if (normalized)
            result.add(normalized);
    }
    return Array.from(result);
}
