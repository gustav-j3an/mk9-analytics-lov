import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAnalyticsDashboard } from "@/lib/mk9-analytics/analytics-engine.server";

const analyticsFiltersSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  compareYear: z.number().int().min(2020).max(2100).optional(),
  compareMonth: z.number().int().min(1).max(12).optional(),
  industryId: z.string().uuid().nullish(),
  uf: z.string().max(2).nullish(),
});

export const getMk9AnalyticsDashboardFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => analyticsFiltersSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // O dashboard analítico Fase 4 consome o engine que processa deltas, riscos e reincidência
    return getAnalyticsDashboard(supabaseAdmin, {
      ...data,
      access: {
        allowedIndustryIds: scope.allowedIndustryIds,
        allowedUfs: scope.allowedUfs,
        allowedStoreIds: scope.allowedStoreIds,
        allowedPromoterIds: scope.allowedPromoterIds,
        canViewPersonalData: scope.canViewPersonalData,
      },
    });
  });
