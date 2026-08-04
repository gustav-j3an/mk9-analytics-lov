/**
 * MK9 — Utilitários de normalização e validação de papéis (roles).
 */

export type Mk9Role = "ADMIN" | "SUPERVISOR" | "PROMOTOR" | "CLIENTE" | "AUDITOR";

const VALID_ROLES: Set<string> = new Set(["ADMIN", "SUPERVISOR", "PROMOTOR", "CLIENTE", "AUDITOR"]);

/**
 * Normaliza uma role para caixa alta e valida se pertence aos valores permitidos.
 * Retorna null se for inválida ou ausente.
 */
export function normalizeMk9Role(role: unknown): Mk9Role | null {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toUpperCase();
  return VALID_ROLES.has(normalized) ? (normalized as Mk9Role) : null;
}

/**
 * Filtra e normaliza uma lista de roles, removendo duplicatas e valores inválidos.
 */
export function normalizeMk9Roles(roles: unknown[]): Mk9Role[] {
  const result = new Set<Mk9Role>();
  for (const r of roles) {
    const normalized = normalizeMk9Role(r);
    if (normalized) result.add(normalized);
  }
  return Array.from(result);
}
