/**
 * MK9 — Fase 2B.4: escopo do DESTINATÁRIO de uma atribuição.
 *
 * Serve a uma única pergunta: "a pessoa que vou responsabilizar consegue
 * enxergar esta ocorrência?". Atribuir para fora do escopo criaria uma
 * tarefa invisível — e um convite a pedir acesso indevido.
 *
 * Lê apenas papéis e linhas de escopo do usuário-alvo. Nenhum dado pessoal.
 */

export interface AssigneeScope {
  role: string;
  allowedIndustryIds: string[] | null;
  allowedStoreIds: string[] | null;
  allowedUfs: string[] | null;
}

const ROLE_PRIORITY = ["ADMIN", "AUDITOR", "SUPERVISOR", "CLIENTE", "PROMOTOR"];

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * `null` quando o usuário não existe, está inativo ou não tem papel interno.
 * Nesses casos a atribuição é recusada.
 */
export async function resolveMk9AccessScopeForUser(
  supabase: any,
  userId: string,
): Promise<AssigneeScope | null> {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("mk9_profiles").select("user_id, active").eq("user_id", userId).maybeSingle(),
    supabase.from("mk9_user_roles").select("role").eq("user_id", userId),
  ]);

  if (!profile || profile.active === false) return null;

  const roles = ((roleRows ?? []) as any[]).map((r) => String(r.role));
  const role = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
  // Só papéis internos podem ser responsáveis por uma ocorrência.
  if (!role || role === "CLIENTE" || role === "PROMOTOR") return null;

  // ADMIN enxerga tudo.
  if (role === "ADMIN") {
    return { role, allowedIndustryIds: null, allowedStoreIds: null, allowedUfs: null };
  }

  const { data: scopeRows } = await supabase
    .from("mk9_user_scopes")
    .select("scope_type, scope_value")
    .eq("user_id", userId);

  const byType = (t: string) =>
    uniq(
      ((scopeRows ?? []) as any[])
        .filter((r) => r.scope_type === t)
        .map((r) => String(r.scope_value)),
    );

  const industries = byType("INDUSTRY");
  const stores = byType("STORE");
  const ufs = byType("UF");

  // Sem linha de escopo = sem restrição naquela dimensão (mesma regra de
  // SUPERVISOR/AUDITOR em access-scope.server.ts).
  return {
    role,
    allowedIndustryIds: industries.length ? industries : null,
    allowedStoreIds: stores.length ? stores : null,
    allowedUfs: ufs.length ? ufs.map((u) => u.toUpperCase()) : null,
  };
}
