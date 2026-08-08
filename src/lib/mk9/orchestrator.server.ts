// Orquestrador de importação. SERVER-ONLY.
// Recebe o arquivo, gera preview ou aplica commit — usa apenas Mk9Repository.
// Portar para Prisma = trocar o adapter no ponto de composição.
import { parseWorkbook } from "./parser";
import { buildSyncPlan } from "./sync";
import { buildRouteDiff, applyRouteDiff } from "./route-diff.server";
import type { Mk9Repository } from "./repository";
import type {
  IndustryRecord,
  PromoterRecord,
  StoreRecord,
  ImportPreview,
  SyncMode,
  PlannedRouteRecord,
  PlannedVisitRecord,
} from "./types";

export interface PreviewInput {
  buffer: ArrayBuffer;
  filename: string;
  operationMonth: number;
  operationYear: number;
  syncMode: SyncMode;
  userId?: string | null;
}

export async function generatePreview(repo: Mk9Repository, input: PreviewInput) {
  const parsed = parseWorkbook(input.buffer, input.filename);
  const [industries, stores, promoters, plannedRoutes, plannedVisits] = await Promise.all([
    repo.listIndustries(),
    repo.listStores(),
    repo.listPromoters(),
    repo.listPlannedRoutes(input.operationMonth, input.operationYear),
    repo.listPlannedVisits(input.operationMonth, input.operationYear),
  ]);
  const plan = buildSyncPlan({
    parsed,
    snapshot: { industries, stores, promoters, plannedRoutes, plannedVisits },
    operationMonth: input.operationMonth,
    operationYear: input.operationYear,
    syncMode: input.syncMode,
  });

  // Diff de rotas com IDs já resolvíveis (preview: pending: refs viram best-effort).
  // Para o preview usamos apenas as rotas cujos IDs já existem no snapshot; as demais
  // aparecerão como NEW_ROUTE após o commit (que resolve pendings antes do diff).
  let routeDiff = undefined as ImportPreview["routeDiff"];
  if (input.syncMode !== "registry_only") {
    const industryIdBy = indexByNorm(industries, industries);
    const storeIdBy = indexStore(stores, stores);
    const promoterIdBy = indexByNorm(promoters, promoters);
    const previewRoutes: PlannedRouteRecord[] = plan.toUpsert.routes
      .map((r) => ({
        ...r,
        promoterId: safeResolve(r.promoterId, promoterIdBy) ?? r.promoterId,
        storeId: safeResolve(r.storeId, storeIdBy) ?? r.storeId,
        industryId: safeResolve(r.industryId, industryIdBy) ?? r.industryId,
      }))
      .filter(
        (r) =>
          !r.promoterId.startsWith("pending:") &&
          !r.storeId.startsWith("pending:") &&
          !r.industryId.startsWith("pending:"),
      );
    routeDiff = await buildRouteDiff(previewRoutes, input.operationMonth, input.operationYear);
  }

  const importRow = await repo.createImport({
    filename: input.filename,
    fileHash: null,
    operationMonth: input.operationMonth,
    operationYear: input.operationYear,
    syncMode: input.syncMode,
    sheetsAnalyzed: parsed.sheetsAnalyzed,
    userId: input.userId,
  });
  const previewWithDiff: ImportPreview = { ...plan.preview, routeDiff };
  await repo.savePreview(importRow.id, previewWithDiff);
  await repo.saveImportItems(importRow.id, plan.preview.items);
  return { importId: importRow.id, preview: previewWithDiff };
}

export interface CommitInput {
  importId: string;
  buffer: ArrayBuffer;
  filename: string;
  operationMonth: number;
  operationYear: number;
  syncMode: SyncMode;
  /** Se true, permite aplicar decisões marcadas como MANUAL_CONFLICT / FUTURE_VERSION_CONFLICT. */
  resolveConflicts?: boolean;
}

export async function commitImport(repo: Mk9Repository, input: CommitInput) {
  const start = Date.now();
  console.info("[IMPORT ROUTE VERSION] diff-based-v3", {
    importId: input.importId,
    filename: input.filename,
    operationMonth: input.operationMonth,
    operationYear: input.operationYear,
    syncMode: input.syncMode,
    resolveConflicts: !!input.resolveConflicts,
  });
  await repo.updateImportStatus(input.importId, { status: "committing" });
  try {
    const parsed = parseWorkbook(input.buffer, input.filename);
    const [industries, stores, promoters, plannedRoutes, plannedVisits] = await Promise.all([
      repo.listIndustries(),
      repo.listStores(),
      repo.listPromoters(),
      repo.listPlannedRoutes(input.operationMonth, input.operationYear),
      repo.listPlannedVisits(input.operationMonth, input.operationYear),
    ]);
    const plan = buildSyncPlan({
      parsed,
      snapshot: { industries, stores, promoters, plannedRoutes, plannedVisits },
      operationMonth: input.operationMonth,
      operationYear: input.operationYear,
      syncMode: input.syncMode,
    });

    // 1) upserts de cadastros — devolvem os registros com IDs reais
    const savedIndustries = await repo.upsertIndustries(plan.toUpsert.industries, input.importId);
    const savedStores = await repo.upsertStores(plan.toUpsert.stores, input.importId);
    const savedPromoters = await repo.upsertPromoters(plan.toUpsert.promoters, input.importId);

    // 2) re-resolver IDs pendentes das rotas/visitas
    const industryIdBy = indexByNorm(savedIndustries, industries);
    const storeIdBy = indexStore(savedStores, stores);
    const promoterIdBy = indexByNorm(savedPromoters, promoters);

    const routesReady: PlannedRouteRecord[] = plan.toUpsert.routes.map((r) => ({
      ...r,
      promoterId: resolvePending(r.promoterId, promoterIdBy),
      storeId: resolvePending(r.storeId, storeIdBy),
      industryId: resolvePending(r.industryId, industryIdBy),
    }));
    const visitsReady: PlannedVisitRecord[] = plan.toUpsert.visits.map((v) => ({
      ...v,
      promoterId: resolvePending(v.promoterId, promoterIdBy),
      storeId: resolvePending(v.storeId, storeIdBy),
      industryId: resolvePending(v.industryId, industryIdBy),
    }));

    // 3) DIFF de rotas + aplicação transacional (substitui o upsert em massa antigo).
    //    Regras: MANUAL preservado; versões futuras preservadas; UNCHANGED mantém route_id.
    const routeDiff = await buildRouteDiff(routesReady, input.operationMonth, input.operationYear);
    console.info("[ROUTE DIFF]", {
      importId: input.importId,
      unchanged: routeDiff.unchanged,
      new: routeDiff.new,
      changedPromoter: routeDiff.changedPromoter,
      changedWeekday: routeDiff.changedWeekday,
      removed: routeDiff.removed,
      manualConflicts: routeDiff.manualConflicts,
      futureConflicts: routeDiff.futureConflicts,
    });
    if (routeDiff.manualConflicts + routeDiff.futureConflicts > 0 && !input.resolveConflicts) {
      throw new Error(
        `ROUTE_DIFF_CONFLICTS::${JSON.stringify({
          manualConflicts: routeDiff.manualConflicts,
          futureConflicts: routeDiff.futureConflicts,
        })}`,
      );
    }
    await applyRouteDiff(input.importId, routeDiff, !!input.resolveConflicts);

    // 4) visitas — mantém rotina antiga (soft-archive via mk9_sync_planned_visits)
    await repo.upsertPlannedVisits(visitsReady, input.importId, plan.toRemove.visitIds);

    const durationMs = Date.now() - start;
    await repo.updateImportStatus(input.importId, {
      status: "done",
      counters: {
        ...(plan.preview.counters as unknown as Record<string, number>),
        routesUnchanged: routeDiff.unchanged,
        routesNew: routeDiff.new,
        routesChangedPromoter: routeDiff.changedPromoter,
        routesChangedWeekday: routeDiff.changedWeekday,
        routesRemovedFromImport: routeDiff.removed,
        routesManualConflicts: routeDiff.manualConflicts,
        routesFutureConflicts: routeDiff.futureConflicts,
      },
      finishedAt: new Date(),
      durationMs,
    });
    return { ok: true, counters: plan.preview.counters, routeDiff };
  } catch (err) {
    const msg = serializeError(err);
    console.error("[mk9 commit] failed:", msg, err);
    await repo.updateImportStatus(input.importId, {
      status: "failed",
      errorMessage: msg,
      finishedAt: new Date(),
      durationMs: Date.now() - start,
    });
    throw new Error(msg);
  }
}

function serializeError(err: unknown): string {
  if (!err) return "Erro desconhecido";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code ? `code=${e.code}` : null]
      .filter(Boolean)
      .map(String);
    if (parts.length) return parts.join(" · ");
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

// helpers
function indexByNorm(
  saved: Array<IndustryRecord | PromoterRecord>,
  snap: Array<IndustryRecord | PromoterRecord>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of snap) if (r.id) m.set(r.nameNormalized, r.id);
  for (const r of saved) if (r.id) m.set(r.nameNormalized, r.id);
  return m;
}
function indexStore(saved: StoreRecord[], snap: StoreRecord[]): Map<string, string> {
  const m = new Map<string, string>();
  const key = (r: StoreRecord) => `${r.nameNormalized}::${r.uf ?? ""}`;
  for (const r of snap) if (r.id) m.set(key(r), r.id);
  for (const r of saved) if (r.id) m.set(key(r), r.id);
  return m;
}
function resolvePending(ref: string, index: Map<string, string>): string {
  if (!ref.startsWith("pending:")) return ref;
  const key = ref.slice("pending:".length);
  const id = index.get(key);
  if (!id) throw new Error(`Falha ao resolver referência pendente: ${ref}`);
  return id;
}
function safeResolve(ref: string, index: Map<string, string>): string | null {
  if (!ref.startsWith("pending:")) return ref;
  const key = ref.slice("pending:".length);
  return index.get(key) ?? null;
}
