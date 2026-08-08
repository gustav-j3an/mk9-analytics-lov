/**
 * MK9 — Camada de autorização para server functions.
 *
 * Estratégia (Fase 4):
 * - Em DESENVOLVIMENTO (NODE_ENV !== "production"): se não houver Authorization
 *   header, mantém o dev-bypass antigo (loga warning) para permitir testes locais
 *   sem login.
 * - Em PRODUÇÃO: sem Authorization header → HTTP 401 imediato. Sem exceções.
 * - Com header: valida token via Supabase e checa mk9_user_roles.
 */

import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeMk9Roles, type Mk9Role } from "./roles";

export type { Mk9Role };

export type Mk9AuthContext = {
  userId: string | null;
  email: string | null;
  roles: Mk9Role[];
  devBypass: boolean;
};

/**
 * Erros de auth como `Error` simples (não subclasses): subclasses de Error não
 * são serializáveis pelo transporte das server functions e viravam
 * "Seroval Error" com HTTP 500, escondendo o 401/403 real do cliente.
 */
function mk9AuthError(statusCode: 401 | 403, message: string): Error {
  const err = new Error(message);
  err.name = statusCode === 401 ? "Mk9UnauthenticatedError" : "Mk9AuthorizationError";
  (err as any).statusCode = statusCode;
  (err as any).mk9Auth = true;
  return err;
}

const Mk9AuthorizationError = (message: string) => mk9AuthError(403, message);
const Mk9UnauthenticatedError = (message: string) => mk9AuthError(401, message);

/**
 * Server functions não propagam o statusCode de um Error: o cliente recebia 500
 * genérico. Lançar uma Response garante 401/403 reais, sem corpo técnico.
 * Rotas HTTP (que passam `request` explicitamente) continuam recebendo Error,
 * pois já traduzem o statusCode em suas próprias respostas.
 */
function authFailure(fromHttpRoute: boolean, statusCode: 401 | 403, message: string): unknown {
  if (fromHttpRoute) return mk9AuthError(statusCode, message);
  return new Response(JSON.stringify({ error: message, code: statusCode }), {
    status: statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * Fase 0.3 — dev-bypass FAIL-CLOSED.
 *
 * O bypass só é permitido quando TODAS as condições abaixo forem verdadeiras:
 *   1. NODE_ENV === "development" (ausente/desconhecido ⇒ fecha);
 *   2. a requisição chegou por um host local (localhost / 127.0.0.1 / [::1]);
 *   3. a variável MK9_DISABLE_DEV_BYPASS não está ligada.
 *
 * Assim o bypass nunca é ativado em preview/produção (hosts *.lovable.app) e
 * não existe header, cookie ou query param capaz de ligá-lo remotamente.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

export function isLocalRequest(request?: Request | null): boolean {
  const host = request?.headers.get("host") ?? "";
  if (!host) return false;
  // Qualquer indício de proxy remoto derruba o bypass.
  const forwarded =
    request?.headers.get("x-forwarded-host") ?? request?.headers.get("x-forwarded-for");
  if (forwarded) return false;
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  return LOCAL_HOSTS.has(hostname);
}

export function devBypassAllowed(request?: Request | null): boolean {
  if (process.env.MK9_DISABLE_DEV_BYPASS === "1") return false;
  if (process.env.NODE_ENV !== "development") return false;
  return isLocalRequest(request);
}

/** Mensagem segura: nunca vaza SQL, constraint, policy ou caminho interno. */
export function sanitizeServerError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const looksInternal =
    /(select|insert|update|delete|from\s+mk9_|relation|constraint|policy|row-level|permission denied|pg[a-z_]*|\/[a-z0-9_.\-\/]+\.(ts|tsx|js)|service_role|supabase)/i.test(
      raw,
    );
  return looksInternal || raw.length > 200 ? "Não foi possível concluir a operação." : raw;
}

function opaqueFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/**
 * Exige que o usuário autenticado possua pelo menos uma das roles indicadas.
 */
export async function requireMk9Role(
  required: Mk9Role[],
  opts?: { request?: Request },
): Promise<Mk9AuthContext> {
  const fromHttpRoute = Boolean(opts?.request);
  const request = opts?.request ?? getRequest();
  const fail = (code: 401 | 403, msg: string) => authFailure(fromHttpRoute, code, msg);
  const authHeader = request?.headers.get("authorization") ?? null;

  if (!authHeader) {
    if (!devBypassAllowed(request)) {
      throw fail(401, "Autenticação obrigatória. Faça login para continuar.");
    }
    console.warn(
      `[MK9-AUTH] dev-bypass local: ação exige ${required.join("|")} — sem Authorization header. ` +
        `Só ocorre em NODE_ENV=development com host local.`,
    );
    return { userId: null, email: null, roles: [], devBypass: true };
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw fail(401, "Formato de autenticação inválido.");
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.split(".").length !== 3) {
    throw fail(401, "Token de autenticação inválido.");
  }

  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: opaqueFetch(anonKey),
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw fail(401, "Sessão expirada ou inválida. Faça login novamente.");
  }
  const user = userData.user;

  const { data: roleRows, error: roleErr } = await supabase
    .from("mk9_user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleErr) {
    console.error("[MK9-AUTH] falha ao ler roles:", roleErr);
    throw fail(403, "Não foi possível validar suas permissões.");
  }

  const roles = normalizeMk9Roles((roleRows ?? []).map((r) => r.role));
  const ok = roles.some((r) => required.includes(r));

  if (!ok) {
    throw fail(
      403,
      `Usuário sem permissão para executar esta ação. Papel exigido: ${required.join(" ou ")}.`,
    );
  }

  return { userId: user.id, email: user.email ?? null, roles, devBypass: false };
}

/**
 * Registra uma ação administrativa em mk9_audit_logs.
 */
export async function logAudit(
  ctx: Mk9AuthContext,
  action: string,
  entity?: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { supabaseAdmin, hasSupabaseAdminConfig } =
      await import("@/integrations/supabase/client.server");

    if (!hasSupabaseAdminConfig()) {
      console.warn(
        `[MK9-AUDIT] privileged audit unavailable (SERVICE_ROLE_KEY missing) - action: ${action}`,
      );
      return;
    }

    await supabaseAdmin.from("mk9_audit_logs").insert({
      user_id: ctx.userId,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      metadata: { ...metadata, devBypass: ctx.devBypass },
    });
  } catch (err) {
    console.error("[MK9-AUDIT] falha ao registrar log (não-crítico):", err);
  }
}
