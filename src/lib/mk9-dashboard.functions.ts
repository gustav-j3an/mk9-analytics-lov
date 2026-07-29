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
    const { requireMk9Read } = await import("@/lib/mk9-auth/read-guards.server");
    await requireMk9Read();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildDashboardOverview } = await import("./mk9-dashboard/engine.server");
    return buildDashboardOverview(supabaseAdmin, {
      year: data.year,
      month: data.month,
      industryId: data.industryId ?? null,
      uf: data.uf ?? null,
      promoterId: data.promoterId ?? null,
      supervisorUserId: data.supervisorUserId ?? null,
    });
  });

/** Lista de supervisores (perfis com papel SUPERVISOR) para o filtro global. */
export const mk9DashboardSupervisorsFn = createServerFn({ method: "GET" }).handler(async () => {
    const { requireMk9Read } = await import("@/lib/mk9-auth/read-guards.server");
    await requireMk9Read();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles, error } = await supabaseAdmin
    .from("mk9_user_roles")
    .select("user_id")
    .eq("role", "SUPERVISOR");
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id as string)));
  if (!ids.length) return [] as Array<{ userId: string; name: string }>;
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("mk9_profiles")
    .select("user_id, name, email")
    .in("user_id", ids);
  if (pErr) throw new Error(pErr.message);
  return (profiles ?? [])
    .map((p: any) => ({ userId: p.user_id as string, name: (p.name || p.email || "Supervisor") as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
});
