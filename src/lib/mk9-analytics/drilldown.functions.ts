import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadOperationCore } from "@/lib/mk9-operations/core.server";

const drilldownSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  industryId: z.string().uuid(),
});

export const getIndustryDrilldownFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => drilldownSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const core = await loadOperationCore(supabaseAdmin, {
      year: data.year,
      month: data.month,
      industryId: data.industryId,
      access: {
        allowedIndustryIds: scope.allowedIndustryIds,
        allowedUfs: scope.allowedUfs,
        allowedStoreIds: scope.allowedStoreIds,
        allowedPromoterIds: scope.allowedPromoterIds,
        canViewPersonalData: scope.canViewPersonalData,
      },
    });

    if (core.empty || core.industryRows.length === 0) {
      throw new Error("Indústria não encontrada ou sem acesso.");
    }

    const industry = core.industryRows[0];
    const stores = core.storeRows.filter(s => s.industryId === data.industryId);

    return {
      industry,
      stores: stores.map(s => ({
        storeId: s.storeId,
        storeName: s.storeName,
        uf: s.uf,
        frequency: s.frequencyLabel,
        contracted: s.contratadas,
        realized: s.realizadas,
        pending: s.pendentes,
        coverage: s.contratadas > 0 ? (s.realizadas / s.contratadas) * 100 : 0,
        lastVisit: s.lastVisit,
      }))
    };
  });
