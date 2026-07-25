// RPCs do motor de conciliação MK9.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const scopeSchema = z.object({
  operationYear: z.number().int().min(2020).max(2100),
  operationMonth: z.number().int().min(1).max(12),
  industryId: z.string().uuid().nullish(),
  sourceImportId: z.string().uuid().nullish(),
});

export const reconcileRun = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => scopeSchema.parse(data))
  .handler(async ({ data }) => {
    const { reconcile } = await import("./mk9-reconciliation/engine.server");
    return reconcile({
      operationYear: data.operationYear,
      operationMonth: data.operationMonth,
      industryId: data.industryId ?? null,
      sourceImportId: data.sourceImportId ?? null,
    });
  });

export const reconcileSummary = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => scopeSchema.parse(data))
  .handler(async ({ data }) => {
    const { summarize } = await import("./mk9-reconciliation/engine.server");
    return summarize({
      operationYear: data.operationYear,
      operationMonth: data.operationMonth,
      industryId: data.industryId ?? null,
      sourceImportId: data.sourceImportId ?? null,
    });
  });

export const reconcileList = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => scopeSchema.parse(data))
  .handler(async ({ data }) => {
    const { listReconciliations } = await import("./mk9-reconciliation/engine.server");
    return listReconciliations({
      operationYear: data.operationYear,
      operationMonth: data.operationMonth,
      industryId: data.industryId ?? null,
      sourceImportId: data.sourceImportId ?? null,
    });
  });

export const reconcileManualMatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        actualVisitId: z.string().uuid(),
        plannedVisitId: z.string().uuid(),
        notes: z.string().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { manualMatch } = await import("./mk9-reconciliation/engine.server");
    return manualMatch({
      actualVisitId: data.actualVisitId,
      plannedVisitId: data.plannedVisitId,
      notes: data.notes ?? null,
    });
  });

export const reconcileIgnore = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ reconciliationId: z.string().uuid(), notes: z.string().nullish() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { markIgnored } = await import("./mk9-reconciliation/engine.server");
    return markIgnored({ reconciliationId: data.reconciliationId, notes: data.notes ?? null });
  });

export const reconcileUndoReview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ reconciliationId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { undoReview } = await import("./mk9-reconciliation/engine.server");
    return undoReview(data.reconciliationId);
  });
