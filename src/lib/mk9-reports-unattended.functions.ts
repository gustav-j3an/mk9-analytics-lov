import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const unattendedPayloadSchema = z.object({
  industryId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  uf: z.string().trim().min(1).max(2).nullish(),
  supervisorId: z.string().uuid().nullish(),
  promoterId: z.string().uuid().nullish(),
});

export const reportIndustryUnattended = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => unattendedPayloadSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9ReportsScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope: access } = await requireMk9ReportsScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPeriodConfig, resolveWindow } = await import("./mk9-reports/period.server");
    const { buildIndustryReport } = await import("./mk9-reports/industry-report.server");

    const cfg = await loadPeriodConfig(supabaseAdmin, data.industryId);
    const window = resolveWindow(cfg, data.year, data.month);

    // Reutilizamos o motor oficial de relatório
    const report = await buildIndustryReport(
      supabaseAdmin,
      {
        industryId: data.industryId,
        year: data.year,
        month: data.month,
        uf: data.uf ?? null,
        access,
      },
      window,
    );

    // Filtramos apenas lojas não atendidas: contratadas > 0 E realizadas == 0
    // Além disso, o motor buildIndustryReport já cuida do escopo e filtros de UF.
    const unattendedStores = report.stores.filter((s) => s.expected > 0 && s.actual === 0);

    return {
      industry: report.industry,
      window: report.window,
      totals: {
        totalContractedStores: report.stores.filter((s) => s.expected > 0).length,
        unattendedStoresCount: unattendedStores.length,
        unattendedContractedVisits: unattendedStores.reduce((sum, s) => sum + s.expected, 0),
      },
      stores: unattendedStores,
      generatedAt: new Date().toISOString(),
    };
  });
