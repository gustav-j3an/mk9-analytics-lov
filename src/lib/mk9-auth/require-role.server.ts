/**
 * MK9 — Camada de autorização para server functions.
 *
 * Estratégia (Fase 3):
 * - Chamado no início do handler de qualquer ação sensível.
 * - Se NÃO houver Authorization header (estado atual do app: sem tela de login) →
 *   permite a execução, loga um aviso e marca contexto como "dev-bypass".
 *   Isso preserva o funcionamento atual e ativa a proteção real automaticamente
 *   assim que a Fase 4 introduzir a tela de login.
 * - Se houver Authorization header → valida o usuário via Supabase, checa se
 *   possui alguma das roles exigidas em mk9_user_roles, e bloqueia com mensagem
 *   clara caso contrário.
 *
 * Também expõe `logAudit()` para registrar ações administrativas críticas.
 */

import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Mk9Role = "ADMIN" | "SUPERVISOR" | "PROMOTOR" | "CLIENTE" | "AUDITOR";

export type Mk9AuthContext = {
  userId: string | null;
  email: string | null;
  roles: Mk9Role[];
  devBypass: boolean;
};

class Mk9AuthorizationError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "Mk9AuthorizationError";
  }
}

class Mk9UnauthenticatedError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "Mk9UnauthenticatedError";
  }
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
 * Retorna o contexto de autenticação para uso pelo handler (audit, etc).
 *
 * @throws Mk9UnauthenticatedError (401) se sessão inválida
 * @throws Mk9AuthorizationError (403) se autenticado mas sem role
 */
export async function requireMk9Role(required: Mk9Role[]): Promise<Mk9AuthContext> {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? null;

  // Sem header: dev bypass (nenhuma tela de login ainda no app).
  if (!authHeader) {
    console.warn(
      `[MK9-AUTH] dev-bypass: ação exige ${required.join("|")} mas nenhum Authorization header foi enviado. ` +
        `Enforcement será ativado quando a tela de login for adicionada.`,
    );
    return { userId: null, email: null, roles: [], devBypass: true };
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Mk9UnauthenticatedError("Formato de autenticação inválido.");
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.split(".").length !== 3) {
    throw new Mk9UnauthenticatedError("Token de autenticação inválido.");
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
    throw new Mk9UnauthenticatedError("Sessão expirada ou inválida. Faça login novamente.");
  }
  const user = userData.user;

  const { data: roleRows, error: roleErr } = await supabase
    .from("mk9_user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleErr) {
    console.error("[MK9-AUTH] falha ao ler roles:", roleErr);
    throw new Mk9AuthorizationError("Não foi possível validar suas permissões.");
  }

  const roles = (roleRows ?? []).map((r) => r.role as Mk9Role);
  const ok = roles.some((r) => required.includes(r));

  if (!ok) {
    throw new Mk9AuthorizationError(
      `Usuário sem permissão para executar esta ação. Papel exigido: ${required.join(" ou ")}.`,
    );
  }

  return { userId: user.id, email: user.email ?? null, roles, devBypass: false };
}

/**
 * Registra uma ação administrativa em mk9_audit_logs.
 * Falhas de log NUNCA quebram o fluxo — apenas são reportadas no console.
 */
export async function logAudit(
  ctx: Mk9AuthContext,
  action: string,
  entity?: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("mk9_audit_logs").insert({
      user_id: ctx.userId,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      metadata: { ...metadata, devBypass: ctx.devBypass },
    });
  } catch (err) {
    console.error("[MK9-AUDIT] falha ao registrar log:", err);
  }
}
