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
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { reconcile } = await import("./mk9-reconciliation/engine.server");
    const result = await reconcile({
      operationYear: data.operationYear,
      operationMonth: data.operationMonth,
      industryId: data.industryId ?? null,
      sourceImportId: data.sourceImportId ?? null,
    });
    await logAudit(
      ctx,
      "mk9.reconcile.run",
      "mk9_visit_reconciliations",
      data.sourceImportId ?? null,
      {
        operationYear: data.operationYear,
        operationMonth: data.operationMonth,
        industryId: data.industryId ?? null,
      },
    );
    return result;
  });

export const reconcileSummary = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => scopeSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope: access } = await requireMk9ReadScope();
    const { summarize } = await import("./mk9-reconciliation/engine.server");
    return summarize({
      operationYear: data.operationYear,
      operationMonth: data.operationMonth,
      industryId: data.industryId ?? null,
      sourceImportId: data.sourceImportId ?? null,
      access,
    });
  });

export const reconcileList = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => scopeSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope: access } = await requireMk9ReadScope();
    const { listReconciliations } = await import("./mk9-reconciliation/engine.server");
    return listReconciliations({
      operationYear: data.operationYear,
      operationMonth: data.operationMonth,
      industryId: data.industryId ?? null,
      sourceImportId: data.sourceImportId ?? null,
      access,
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
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { manualMatch } = await import("./mk9-reconciliation/engine.server");
    const result = await manualMatch({
      actualVisitId: data.actualVisitId,
      plannedVisitId: data.plannedVisitId,
      notes: data.notes ?? null,
    });
    await logAudit(
      ctx,
      "mk9.reconcile.manualMatch",
      "mk9_visit_reconciliations",
      data.actualVisitId,
    );
    return result;
  });

export const reconcileIgnore = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ reconciliationId: z.string().uuid(), notes: z.string().nullish() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { markIgnored } = await import("./mk9-reconciliation/engine.server");
    const result = await markIgnored({
      reconciliationId: data.reconciliationId,
      notes: data.notes ?? null,
    });
    await logAudit(ctx, "mk9.reconcile.ignore", "mk9_visit_reconciliations", data.reconciliationId);
    return result;
  });

export const reconcileUndoReview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ reconciliationId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { undoReview } = await import("./mk9-reconciliation/engine.server");
    const result = await undoReview(data.reconciliationId);
    await logAudit(
      ctx,
      "mk9.reconcile.undoReview",
      "mk9_visit_reconciliations",
      data.reconciliationId,
    );
    return result;
  });

const pagedSchema = z.object({
  operationYear: z.number().int().min(2020).max(2100),
  operationMonth: z.number().int().min(1).max(12),
  industryId: z.string().uuid().nullish(),
  sourceImportId: z.string().uuid().nullish(),
  promoterId: z.string().uuid().nullish(),
  storeId: z.string().uuid().nullish(),
  uf: z.string().nullish(),
  statuses: z.array(z.string()).nullish(),
  search: z.string().nullish(),
  page: z.number().int().min(1).max(10000).nullish(),
  pageSize: z.number().int().min(1).max(200).nullish(),
});

export const reconcileListPaged = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pagedSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope: access } = await requireMk9ReadScope();
    const { listReconciliationsPaged } = await import("./mk9-reconciliation/engine.server");
    return listReconciliationsPaged({
      operationYear: data.operationYear,
      operationMonth: data.operationMonth,
      industryId: data.industryId ?? null,
      sourceImportId: data.sourceImportId ?? null,
      promoterId: data.promoterId ?? null,
      storeId: data.storeId ?? null,
      uf: data.uf ?? null,
      statuses: (data.statuses ?? null) as any,
      search: data.search ?? null,
      page: data.page ?? 1,
      pageSize: data.pageSize ?? 50,
      access,
    });
  });

export const reconcileDetail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope: access } = await requireMk9ReadScope();
    const { getReconciliationDetail } = await import("./mk9-reconciliation/engine.server");
    return getReconciliationDetail(data.id, access);
  });

export const reconcileFindCandidates = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        actualVisitId: z.string().uuid(),
        windowDays: z.number().int().min(1).max(60).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope: access } = await requireMk9ReadScope();
    const { findPlannedCandidates } = await import("./mk9-reconciliation/engine.server");
    return findPlannedCandidates({
      actualVisitId: data.actualVisitId,
      windowDays: data.windowDays ?? 7,
      access,
    });
  });

export const reconcileAcceptDivergence = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ reconciliationId: z.string().uuid(), notes: z.string().nullish() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { acceptDivergence } = await import("./mk9-reconciliation/engine.server");
    const result = await acceptDivergence({
      reconciliationId: data.reconciliationId,
      notes: data.notes ?? null,
    });
    await logAudit(
      ctx,
      "mk9.reconcile.acceptDivergence",
      "mk9_visit_reconciliations",
      data.reconciliationId,
    );
    return result;
  });

export const reconcileSearchStores = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        query: z.string().default(""),
        uf: z.string().nullish(),
        limit: z.number().int().min(1).max(50).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope: access } = await requireMk9ReadScope();
    const { searchStores } = await import("./mk9-reconciliation/engine.server");
    return searchStores({
      query: data.query,
      uf: data.uf ?? null,
      limit: data.limit ?? 20,
      access,
    });
  });

export const reconcileLinkStore = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        reconciliationId: z.string().uuid(),
        storeId: z.string().uuid(),
        notes: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR"]);
    const { linkStoreToReconciliation } = await import("./mk9-reconciliation/engine.server");
    const result = await linkStoreToReconciliation({
      reconciliationId: data.reconciliationId,
      storeId: data.storeId,
      notes: data.notes ?? null,
    });
    await logAudit(
      ctx,
      "mk9.reconcile.linkStore",
      "mk9_visit_reconciliations",
      data.reconciliationId,
      { storeId: data.storeId },
    );
    return result;
  });

export const reconcileListImports = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        operationYear: z.number().int().min(2020).max(2100),
        operationMonth: z.number().int().min(1).max(12),
        industryId: z.string().uuid().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope: access } = await requireMk9ReadScope();
    const { listChecklistImportsInScope } = await import("./mk9-reconciliation/engine.server");
    return listChecklistImportsInScope({
      operationYear: data.operationYear,
      operationMonth: data.operationMonth,
      industryId: data.industryId ?? null,
      access,
    });
  });
