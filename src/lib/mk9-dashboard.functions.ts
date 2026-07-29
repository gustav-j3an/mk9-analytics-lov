// Server functions do Dashboard Operacional MK9.
// Uma única função agregada alimenta toda a tela (nada de dados brutos no browser).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const filtersSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  industryId: z.string().uuid().nullish(),
  uf: z.string().max(2).nullish(),
  promoterId: z.string().uuid().nullish(),
  supervisorUserId: z.string().uuid().nullish(),
});

export const mk9DashboardOverviewFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => filtersSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildDashboardOverview } = await import("./mk9-dashboard/engine.server");
    // Filtro de supervisor só é aceito de quem pode ver todos os supervisores.
    const supervisorUserId = scope.canViewAll
      ? (data.supervisorUserId ?? null)
      : scope.allowedSupervisorIds && data.supervisorUserId && scope.allowedSupervisorIds.includes(data.supervisorUserId)
        ? data.supervisorUserId
        : null;
    return buildDashboardOverview(supabaseAdmin, {
      year: data.year,
      month: data.month,
      industryId: data.industryId ?? null,
      uf: data.uf ?? null,
      promoterId: data.promoterId ?? null,
      supervisorUserId,
      access: {
        allowedIndustryIds: scope.allowedIndustryIds,
        allowedUfs: scope.allowedUfs,
        allowedStoreIds: scope.allowedStoreIds,
        allowedPromoterIds: scope.allowedPromoterIds,
        canViewPersonalData: scope.canViewPersonalData,
      },
    });
  });

/** Lista de supervisores (perfis com papel SUPERVISOR) para o filtro global. */
export const mk9DashboardSupervisorsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
  const { scope } = await requireMk9ReadScope();
  // Filtro por supervisor é uma visão gerencial: apenas quem enxerga tudo
  // (ou tem supervisores explicitamente atribuídos) recebe a lista.
  if (!scope.canViewAll && !scope.allowedSupervisorIds?.length) {
    return [] as Array<{ userId: string; name: string }>;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let rq = supabaseAdmin.from("mk9_user_roles").select("user_id").eq("role", "SUPERVISOR");
  if (!scope.canViewAll && scope.allowedSupervisorIds) rq = rq.in("user_id", scope.allowedSupervisorIds);
  const { data: roles, error } = await rq;
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id as string)));
  if (!ids.length) return [] as Array<{ userId: string; name: string }>;
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("mk9_profiles")
    .select("user_id, name, email")
    .in("user_id", ids);
  if (pErr) throw new Error(pErr.message);
  // E-mail (dado pessoal) nunca é enviado ao navegador: só o nome de exibição.
  return (profiles ?? [])
    .map((p: any) => ({
      userId: p.user_id as string,
      name: (p.name || (scope.canViewPersonalData ? p.email : null) || "Supervisor") as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
});

