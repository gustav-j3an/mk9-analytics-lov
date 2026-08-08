// Server function do Cockpit Operacional MK9 (Fase 3.1B).
// Payload fechado: o navegador nunca recebe linha bruta do banco.
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

export const mk9CockpitOverviewFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => filtersSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildCockpitOverview } = await import("./mk9-cockpit/engine.server");

    // Filtro de supervisor só é aceito de quem enxerga supervisores.
    const supervisorUserId = scope.canViewAll
      ? (data.supervisorUserId ?? null)
      : scope.allowedSupervisorIds &&
          data.supervisorUserId &&
          scope.allowedSupervisorIds.includes(data.supervisorUserId)
        ? data.supervisorUserId
        : null;

    const { mk9ListIndustries, mk9ListPromoters } = await import("@/lib/mk9-data.functions");

    // Otimização: Carregamos tudo em paralelo (Data + Metadata)
    const [overview, industries, promoters] = await Promise.all([
      buildCockpitOverview(
        supabaseAdmin,
        {
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
        },
        {
          role: scope.role,
          canViewImports: scope.canViewImports,
          canViewPersonalData: scope.canViewPersonalData,
        },
      ),
      mk9ListIndustries(),
      mk9ListPromoters(),
    ]);

    return {
      ...overview,
      meta: {
        industries,
        promoters,
      },
    };
  });
