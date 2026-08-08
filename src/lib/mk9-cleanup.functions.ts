import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMk9Role } from "./mk9-auth/require-role.server";

const cleanupFilterSchema = z.object({
  industryId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

/**
 * Diagnóstico genérico baseado no motor do PDF.
 */
export const getCleanupDiagnosis = createServerFn({ method: "POST" })
  .inputValidator((data) => cleanupFilterSchema.parse(data))
  .handler(async ({ data }) => {
    await requireMk9Role(["ADMIN"]);
    const { traceIndustryReportSources } = await import("./mk9-cleanup/trace.server");
    return traceIndustryReportSources(data);
  });

/**
 * Execução genérica e granular da limpeza.
 */
export const executeGranularCleanup = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        industryId: z.string().uuid(),
        month: z.number(),
        year: z.number(),
        justification: z.string().min(10),
        selections: z.object({
          importIds: z.array(z.string().uuid()),
          visitIds: z.array(z.string().uuid()),
          frequencyIds: z.array(z.string().uuid()),
          projectionIds: z.array(z.string().uuid()),
          routeIds: z.array(z.string().uuid()),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    const { executeGranularCleanup: exec } = await import("./mk9-cleanup/execute.server");

    return exec({
      industryId: data.industryId,
      month: data.month,
      year: data.year,
      reason: data.justification,
      actorId: ctx.userId!,
      selectedSources: {
        visitIds: data.selections.visitIds,
        frequencyIds: data.selections.frequencyIds,
        importIds: data.selections.importIds,
        projectionIds: data.selections.projectionIds,
        routeIds: data.selections.routeIds,
      },
    });
  });
