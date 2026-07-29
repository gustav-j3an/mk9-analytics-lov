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

export function requireMk9Read(request?: Request): Promise<Mk9AuthContext> {
  return requireMk9Role(MK9_READ_OPS, request ? { request } : undefined);
}

export function requireMk9Reports(request?: Request): Promise<Mk9AuthContext> {
  return requireMk9Role(MK9_READ_REPORTS, request ? { request } : undefined);
}

export function requireMk9AdminRead(request?: Request): Promise<Mk9AuthContext> {
  return requireMk9Role(MK9_READ_ADMIN, request ? { request } : undefined);
}

// ---------------------------------------------------------------------------
// Fase 0.2 — guardas que já devolvem o escopo resolvido (uma vez por request).
// ---------------------------------------------------------------------------
import { resolveMk9AccessScope, type Mk9AccessScope } from "./access-scope.server";

export interface Mk9ReadSession {
  ctx: Mk9AuthContext;
  scope: Mk9AccessScope;
}

async function withScope(ctx: Mk9AuthContext): Promise<Mk9ReadSession> {
  return { ctx, scope: await resolveMk9AccessScope(ctx) };
}

export async function requireMk9ReadScope(request?: Request): Promise<Mk9ReadSession> {
  return withScope(await requireMk9Read(request));
}

export async function requireMk9ReportsScope(request?: Request): Promise<Mk9ReadSession> {
  return withScope(await requireMk9Reports(request));
}

export async function requireMk9AdminReadScope(request?: Request): Promise<Mk9ReadSession> {
  return withScope(await requireMk9AdminRead(request));
}

export async function requireMk9RoleScope(roles: Mk9Role[], request?: Request): Promise<Mk9ReadSession> {
  return withScope(await requireMk9Role(roles, request ? { request } : undefined));
}
