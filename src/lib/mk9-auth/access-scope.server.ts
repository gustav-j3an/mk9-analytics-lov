/**
 * MK9 — Fase 0.2: resolver central de escopo de acesso.
 *
 * MODELO REAL (auditado no banco):
 *   - papéis .......... public.mk9_user_roles (enum mk9_role)
 *   - perfis .......... public.mk9_profiles (user_id, name, email, phone, active)
 *   - escopo .......... public.mk9_user_scopes (user_id, scope_type, scope_value)
 *                       scope_type usados: INDUSTRY | UF | STORE | PROMOTER | SUPERVISOR
 *   - helpers SQL ..... is_mk9_admin(), has_mk9_role(), user_has_mk9_scope(),
 *                       mk9_visible_industry(uuid), mk9_visible_store(text uf)
 *
 * LACUNAS REGISTRADAS (não inventadas aqui):
 *   - hoje mk9_user_scopes está VAZIA (0 linhas) → todo usuário não-CLIENTE
 *     enxerga tudo, exatamente como antes desta fase (sem regressão para ADMIN).
 *   - não existe vínculo supervisor→promotor nem supervisor→loja no schema.
 *     Escopo de promotor/supervisor só existe se cadastrado em mk9_user_scopes.
 *   - lojas não têm coluna de cidade; escopo de loja é derivado por UF
 *     (ou por linhas STORE explícitas, quando cadastradas).
 *
 * REGRA GERAL: filtros vindos do navegador NUNCA ampliam o escopo — eles são
 * sempre intersectados com o escopo resolvido no servidor.
 */
import type { Mk9AuthContext, Mk9Role } from "./require-role.server";

/**
 * Erro de escopo como `Error` simples: subclasses de Error não são
 * serializáveis pelo transporte das server functions (viravam HTTP 500
 * genérico em vez do 403 real). `new Mk9ScopeError()` continua válido.
 */
export const Mk9ScopeError = function Mk9ScopeError(
  this: unknown,
  message = "Recurso fora do seu escopo de acesso.",
): Error {
  const err = new Error(message);
  err.name = "Mk9ScopeError";
  (err as any).statusCode = 403;
  (err as any).mk9Scope = true;
  return err;
} as unknown as { new (message?: string): Error; (message?: string): Error };

export interface Mk9AccessScope {
  userId: string | null;
  roles: Mk9Role[];
  role: Mk9Role | "DEV";
  canViewAll: boolean;
  /** null = todas as indústrias; [] = nenhuma. */
  allowedIndustryIds: string[] | null;
  /** null = todas as lojas (dentro das UFs); [] = nenhuma. */
  allowedStoreIds: string[] | null;
  allowedUfs: string[] | null;
  allowedSupervisorIds: string[] | null;
  allowedPromoterIds: string[] | null;
  canViewPersonalData: boolean;
  canViewImports: boolean;
  canViewImportPayload: boolean;
  canGenerateReports: boolean;
  /** Hash estável do escopo — usado nas chaves de cache. */
  scopeHash: string;
}

const ROLE_PRIORITY: Mk9Role[] = ["ADMIN", "AUDITOR", "SUPERVISOR", "CLIENTE", "PROMOTOR"];

function primaryRole(roles: Mk9Role[]): Mk9Role | null {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return null;
}

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function uniqSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

const scopeCache = new WeakMap<Mk9AuthContext, Promise<Mk9AccessScope>>();

/**
 * Resolve (uma única vez por contexto/requisição) o escopo efetivo do usuário.
 */
export function resolveMk9AccessScope(ctx: Mk9AuthContext): Promise<Mk9AccessScope> {
  const cached = scopeCache.get(ctx);
  if (cached) return cached;
  const promise = computeScope(ctx);
  scopeCache.set(ctx, promise);
  return promise;
}

async function computeScope(ctx: Mk9AuthContext): Promise<Mk9AccessScope> {
  // Dev-bypass (somente ambiente local de desenvolvimento — ver require-role.server).
  // Fase 0.3: sem devBypass e sem userId ⇒ falha fechado (nunca escopo global).
  if (!ctx.devBypass && !ctx.userId) {
    throw new Mk9ScopeError("Sessão inválida para resolver escopo de acesso.");
  }
  if (ctx.devBypass) {
    return finalize({
      userId: ctx.userId,
      roles: ctx.roles,
      role: "DEV",
      canViewAll: true,
      allowedIndustryIds: null,
      allowedStoreIds: null,
      allowedUfs: null,
      allowedSupervisorIds: null,
      allowedPromoterIds: null,
      canViewPersonalData: true,
      canViewImports: true,
      canViewImportPayload: true,
      canGenerateReports: true,
    });
  }

  const role = primaryRole(ctx.roles);
  const userId = ctx.userId as string;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // service_role justificado: leitura das PRÓPRIAS linhas de escopo do usuário,
  // filtrada por user_id, antes de qualquer decisão de autorização.
  const { data: rows, error } = await supabaseAdmin
    .from("mk9_user_scopes")
    .select("scope_type, scope_value")
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível resolver o escopo de acesso.");

  const byType = (t: string) =>
    uniqSorted((rows ?? []).filter((r: any) => r.scope_type === t).map((r: any) => String(r.scope_value)));

  const industries = byType("INDUSTRY");
  const ufs = byType("UF");
  const stores = byType("STORE");
  const promoters = byType("PROMOTER");
  const supervisors = byType("SUPERVISOR");

  if (role === "ADMIN") {
    return finalize({
      userId: ctx.userId, roles: ctx.roles, role: "ADMIN", canViewAll: true,
      allowedIndustryIds: null, allowedStoreIds: null, allowedUfs: null,
      allowedSupervisorIds: null, allowedPromoterIds: null,
      canViewPersonalData: true, canViewImports: true, canViewImportPayload: true,
      canGenerateReports: true,
    });
  }

  if (role === "CLIENTE") {
    // CLIENTE só enxerga indústrias explicitamente liberadas (sem linhas = nada).
    return finalize({
      userId: ctx.userId, roles: ctx.roles, role: "CLIENTE", canViewAll: false,
      allowedIndustryIds: industries,
      allowedStoreIds: stores.length ? stores : null,
      allowedUfs: ufs.length ? ufs : null,
      allowedSupervisorIds: [], allowedPromoterIds: promoters.length ? promoters : null,
      canViewPersonalData: false, canViewImports: false, canViewImportPayload: false,
      canGenerateReports: true,
    });
  }

  if (role === "PROMOTOR") {
    return finalize({
      userId: ctx.userId, roles: ctx.roles, role: "PROMOTOR", canViewAll: false,
      allowedIndustryIds: industries.length ? industries : null,
      allowedStoreIds: stores.length ? stores : null,
      allowedUfs: ufs.length ? ufs : null,
      allowedSupervisorIds: [],
      allowedPromoterIds: promoters,
      canViewPersonalData: false, canViewImports: false, canViewImportPayload: false,
      canGenerateReports: false,
    });
  }

  // Fase 0.3: usuário autenticado sem papel MK9 reconhecido ⇒ escopo vazio
  // (nunca herda o comportamento irrestrito de SUPERVISOR/AUDITOR).
  if (!role) {
    return finalize({
      userId: ctx.userId, roles: ctx.roles, role: "PROMOTOR", canViewAll: false,
      allowedIndustryIds: [], allowedStoreIds: [], allowedUfs: [],
      allowedSupervisorIds: [], allowedPromoterIds: [],
      canViewPersonalData: false, canViewImports: false, canViewImportPayload: false,
      canGenerateReports: false,
    });
  }

  // AUDITOR e SUPERVISOR: irrestritos por padrão (paridade com os helpers SQL),
  // restritos assim que houver linhas em mk9_user_scopes.
  const isAuditor = role === "AUDITOR";
  return finalize({
    userId: ctx.userId,
    roles: ctx.roles,
    role: role ?? "SUPERVISOR",
    canViewAll: !industries.length && !ufs.length && !stores.length,
    allowedIndustryIds: industries.length ? industries : null,
    allowedStoreIds: stores.length ? stores : null,
    allowedUfs: ufs.length ? ufs : null,
    allowedSupervisorIds: supervisors.length ? supervisors : null,
    allowedPromoterIds: promoters.length ? promoters : null,
    canViewPersonalData: false,
    canViewImports: true,
    canViewImportPayload: false,
    canGenerateReports: isAuditor || role === "SUPERVISOR",
  });
}

function finalize(s: Omit<Mk9AccessScope, "scopeHash">): Mk9AccessScope {
  const raw = JSON.stringify([
    s.userId, s.role, s.canViewAll, s.allowedIndustryIds, s.allowedStoreIds,
    s.allowedUfs, s.allowedPromoterIds, s.allowedSupervisorIds,
    s.canViewPersonalData, s.canViewImports, s.canGenerateReports,
  ]);
  return { ...s, scopeHash: hash(raw) };
}

// ---------------------------------------------------------------------------
// INTERSECÇÃO DE FILTROS (cliente → escopo do servidor)
// ---------------------------------------------------------------------------

export interface ScopedFilter {
  /** null = sem restrição; array vazio = nada visível. */
  ids: string[] | null;
  /** true quando o filtro pedido está fora do escopo (resultado deve ser vazio). */
  outOfScope: boolean;
}

export function intersectFilter(allowed: string[] | null, requested?: string | null): ScopedFilter {
  if (!requested) return { ids: allowed, outOfScope: allowed !== null && allowed.length === 0 };
  if (allowed === null) return { ids: [requested], outOfScope: false };
  if (!allowed.includes(requested)) return { ids: [], outOfScope: true };
  return { ids: [requested], outOfScope: false };
}

export function industryFilter(scope: Mk9AccessScope, requested?: string | null): ScopedFilter {
  return intersectFilter(scope.allowedIndustryIds, requested ?? null);
}

/**
 * UF: normaliza caixa/espaços e rejeita valores inválidos ("Todas", "DF,GO", "").
 * Valor inválido NUNCA amplia — cai para o escopo do servidor.
 */
export function ufFilter(scope: Mk9AccessScope, requested?: string | null): ScopedFilter {
  const raw = (requested ?? "").trim().toUpperCase();
  const valid = /^[A-Z]{2}$/.test(raw) ? raw : null;
  return intersectFilter(scope.allowedUfs, valid);
}

export function storeFilter(scope: Mk9AccessScope, requested?: string | null): ScopedFilter {
  return intersectFilter(scope.allowedStoreIds, requested ?? null);
}

export function promoterFilter(scope: Mk9AccessScope, requested?: string | null): ScopedFilter {
  return intersectFilter(scope.allowedPromoterIds, requested ?? null);
}

/** Lança 403 quando a indústria pedida está fora do escopo (usado em relatórios/PDF). */
export function assertIndustryAllowed(scope: Mk9AccessScope, industryId: string): void {
  // ADMIN ou usuários com canViewAll=true (visão total) enxergam todas as indústrias.
  if (scope.canViewAll || scope.allowedIndustryIds === null) return;
  
  if (!scope.allowedIndustryIds.includes(industryId)) {
    throw new Mk9ScopeError("Indústria fora do seu escopo de acesso.");
  }
}

export function assertStoreAllowed(scope: Mk9AccessScope, storeId: string | null, uf: string | null): void {
  if (storeId && scope.allowedStoreIds && !scope.allowedStoreIds.includes(storeId)) {
    throw new Mk9ScopeError("Loja fora do seu escopo de acesso.");
  }
  if (scope.allowedUfs && uf && !scope.allowedUfs.includes(uf)) {
    throw new Mk9ScopeError("Loja fora do seu escopo de acesso.");
  }
}

/** Aplica escopo de indústria/UF a uma linha já carregada (defesa em profundidade). */
export function rowInScope(
  scope: Mk9AccessScope,
  row: { industryId?: string | null; storeId?: string | null; uf?: string | null },
): boolean {
  if (scope.allowedIndustryIds && row.industryId && !scope.allowedIndustryIds.includes(row.industryId)) return false;
  if (scope.allowedStoreIds && row.storeId && !scope.allowedStoreIds.includes(row.storeId)) return false;
  if (scope.allowedUfs && row.uf !== undefined) {
    if (!row.uf || !scope.allowedUfs.includes(row.uf)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// DTOs DE PROMOTOR (mínimo necessário por uso)
// ---------------------------------------------------------------------------

export interface PromoterSummary { id: string; name: string }
export interface PromoterOperationalView extends PromoterSummary { externalId: string | null; city: string | null }
export interface PromoterAdminView extends PromoterOperationalView { contact: string | null; notes: string | null; updatedAt: string }

export function toPromoterView(
  scope: Mk9AccessScope,
  row: any,
): PromoterSummary | PromoterOperationalView | PromoterAdminView {
  const base: PromoterSummary = { id: row.id as string, name: row.name as string };
  if (scope.role === "CLIENTE") return base;
  const operational: PromoterOperationalView = {
    ...base,
    externalId: (row.external_id as string | null) ?? null,
    city: (row.city as string | null) ?? null,
  };
  if (!scope.canViewPersonalData) return operational;
  return {
    ...operational,
    contact: (row.contact as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}
