/**
 * MK9 — Guardas de leitura (Fase 0.1).
 *
 * Centraliza os conjuntos de papéis autorizados a LER dados operacionais.
 * Usa exclusivamente o helper oficial `requireMk9Role` (nenhum mecanismo novo
 * de autenticação é criado aqui).
 *
 * Presets:
 * - requireMk9Read      → leituras operacionais (dashboard, roteiros, auditoria,
 *                          conciliação, cadastros): ADMIN, SUPERVISOR, AUDITOR.
 * - requireMk9Reports   → leituras de relatório, também liberadas ao CLIENTE.
 * - requireMk9AdminRead → leituras administrativas (histórico de importações).
 */
import { requireMk9Role, type Mk9AuthContext, type Mk9Role } from "./require-role.server";

export const MK9_READ_OPS: Mk9Role[] = ["ADMIN", "SUPERVISOR", "AUDITOR"];
export const MK9_READ_REPORTS: Mk9Role[] = ["ADMIN", "SUPERVISOR", "AUDITOR", "CLIENTE"];
export const MK9_READ_ADMIN: Mk9Role[] = ["ADMIN", "AUDITOR"];

export function requireMk9Read(): Promise<Mk9AuthContext> {
  return requireMk9Role(MK9_READ_OPS);
}

export function requireMk9Reports(): Promise<Mk9AuthContext> {
  return requireMk9Role(MK9_READ_REPORTS);
}

export function requireMk9AdminRead(): Promise<Mk9AuthContext> {
  return requireMk9Role(MK9_READ_ADMIN);
}
