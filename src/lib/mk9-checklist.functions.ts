// RPCs do módulo Importador de Checklists.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ChecklistPreview } from "./mk9-checklist/types";

const previewSchema = z.object({
  filename: z.string().min(1),
  base64: z.string().min(4),
  industryId: z.string().uuid(),
  operationMonth: z.number().int().min(1).max(12),
  operationYear: z.number().int().min(2020).max(2100),
});

const commitItemSchema = z.object({
  storeId: z.string().uuid().nullable().optional(),
  storeName: z.string().min(1),
  storeNormalized: z.string().min(1),
  uf: z.string().length(2).nullable().optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isNew: z.boolean().optional(),
});

const commitSchema = z.object({
  importId: z.string().uuid(),
  industryId: z.string().uuid(),
  operationMonth: z.number().int().min(1).max(12),
  operationYear: z.number().int().min(2020).max(2100),
  items: z.array(commitItemSchema),
});

async function validate<T>(step: string, fn: () => T): Promise<T> {
  const { withRichErrors } = await import("./mk9-checklist/errors.server");
  return withRichErrors({ step: "validate-input", function: step }, async () => fn());
}

function b64ToArrayBuffer(base64: string): ArrayBuffer {
  const bin = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export const checklistPreview = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => validate("checklistPreview", () => previewSchema.parse(data)))
  .handler(async ({ data }) => {
    const { createChecklistDiagnostics } = await import("./mk9-checklist/diagnostics");
    const { runChecklistPreview } = await import("./mk9-checklist/preview.server");
    const diagnostics = createChecklistDiagnostics("preview-server-fn");
    const result = await runChecklistPreview(
      {
        buffer: b64ToArrayBuffer(data.base64),
        filename: data.filename,
        fileSize: Math.floor((data.base64.length * 3) / 4),
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        industryId: data.industryId,
        operationMonth: data.operationMonth,
        operationYear: data.operationYear,
      },
      diagnostics,
    );
    return { importId: result.importId, preview: result.preview };
  });

export const checklistCommit = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => validate("checklistCommit", () => commitSchema.parse(data)))
  .handler(async ({ data }) => {
    const { withRichErrors, buildRichError } = await import("./mk9-checklist/errors.server");
    const {
      persistActualVisits,
      updateImportStatus,
      ensureChecklistStores,
      loadPreviewSnapshot,
      upsertIndustryStoreFrequencies,
    } = await import("./mk9-checklist/persistence.server");
    const startedAt = Date.now();
    // Marca committing logo no início para que o histórico saia de "previewing".
    await updateImportStatus(data.importId, { status: "committing" }).catch(() => undefined);
    try {
      // 1) Cria/reaproveita lojas ausentes (isNew=true). Lojas já resolvidas passam direto.
      const newCandidates = data.items
        .filter((i) => i.isNew || !i.storeId)
        .map((i) => ({ storeName: i.storeName, storeNormalized: i.storeNormalized, uf: i.uf ?? null }));


      const createdMap = await withRichErrors(
        { step: "ensure-checklist-stores", function: "checklistCommit", extra: { candidates: newCandidates.length } },
        () => ensureChecklistStores(data.importId, newCandidates),
      );

      let storesCreated = 0;
      let storesReused = 0;
      for (const v of createdMap.values()) {
        if (v.created) storesCreated++;
        else storesReused++;
      }

      // 2) Resolve storeId final por item.
      const resolvedItems: Array<{ storeId: string; scheduledDate: string }> = [];
      const unresolved: Array<{ storeName: string; uf: string | null }> = [];
      for (const it of data.items) {
        if (it.storeId) {
          resolvedItems.push({ storeId: it.storeId, scheduledDate: it.scheduledDate });
          continue;
        }
        const key = `${it.storeNormalized}|${it.uf ?? ""}`;
        const found = createdMap.get(key);
        if (found) {
          resolvedItems.push({ storeId: found.storeId, scheduledDate: it.scheduledDate });
        } else {
          unresolved.push({ storeName: it.storeName, uf: it.uf ?? null });
        }
      }

      // 3) Persiste visitas realizadas.
      const { persisted, skipped } = await withRichErrors(
        {
          step: "persist-actual-visits",
          function: "checklistCommit",
          extra: { importId: data.importId, count: resolvedItems.length },
        },
        () => persistActualVisits(data.importId, data.industryId, resolvedItems),
      );

      // 4) Persiste frequência contratada por loja (usa o snapshot da prévia
      //    salvo em mk9_checklist_imports.preview). Fonte oficial da métrica
      //    "visitas contratadas" no relatório da indústria.
      let frequenciesUpserted = 0;
      try {
        const snapshot = await loadPreviewSnapshot(data.importId);
        const freqs = snapshot?.storeFrequencies ?? [];
        if (freqs.length) {
          // Resolve storeId por (normalized|uf) — usa createdMap para lojas novas
          // e o próprio item da prévia para lojas já resolvidas.
          const storeIdByKey = new Map<string, string>();
          for (const it of data.items) {
            if (it.storeId) storeIdByKey.set(`${it.storeNormalized}|${it.uf ?? ""}`, it.storeId);
          }
          for (const [key, v] of createdMap) storeIdByKey.set(key, v.storeId);
          const rows = freqs
            .map((f) => ({
              storeId: storeIdByKey.get(`${f.storeNormalized}|${f.uf ?? ""}`) ?? null,
              weeklyFrequency: f.weeklyFrequency,
              monthlyFrequency: f.monthlyFrequency,
            }))
            .filter((r): r is { storeId: string; weeklyFrequency: number | null; monthlyFrequency: number | null } => !!r.storeId);
          const { upserted } = await upsertIndustryStoreFrequencies(data.industryId, data.importId, rows);
          frequenciesUpserted = upserted;
        }
      } catch (freqErr) {
        // Falha na frequência não deve derrubar o commit; apenas registra em counters.
        console.error("[checklistCommit] upsert frequencies failed", freqErr);
      }

      const counters = {
        persisted,
        skipped,
        total: data.items.length,
        storesCreated,
        storesReused,
        unresolved: unresolved.length,
      };

      await updateImportStatus(data.importId, {
        status: "done",
        counters,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
      });

      let reconciliationError: string | null = null;
      try {
        const { reconcile } = await import("./mk9-reconciliation/engine.server");
        await reconcile({
          operationYear: data.operationYear,
          operationMonth: data.operationMonth,
          industryId: data.industryId,
          sourceImportId: data.importId,
        });
      } catch (recErr: any) {
        reconciliationError = String(recErr?.message ?? recErr);
      }

      return {
        importId: data.importId,
        persisted,
        skipped,
        total: data.items.length,
        storesCreated,
        storesReused,
        unresolved: unresolved.length,
        reconciliationError,
      };
    } catch (e: any) {
      let msg: string;
      try {
        msg = e?.message ?? String(e);
      } catch {
        msg = "Erro desconhecido";
      }
      await updateImportStatus(data.importId, {
        status: "failed",
        errorMessage: msg.slice(0, 4000),
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
      });
      if (!msg.startsWith("{")) {
        const payload = buildRichError(e, { step: "commit-outer", function: "checklistCommit" });
        throw new Error(JSON.stringify(payload));
      }
      throw e;
    }
  });

export const checklistList = createServerFn({ method: "GET" }).handler(async () => {
  const { listChecklistImports } = await import("./mk9-checklist/persistence.server");
  return listChecklistImports(30);
});

export const checklistDelete = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => validate("checklistDelete", () => z.object({ importId: z.string().uuid() }).parse(data)))
  .handler(async ({ data }) => {
    const { deleteChecklistImport } = await import("./mk9-checklist/persistence.server");
    await deleteChecklistImport(data.importId);
    return { ok: true };
  });

// Marca a prévia como descartada sem apagar o registro do histórico.
export const checklistCancel = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => validate("checklistCancel", () => z.object({ importId: z.string().uuid() }).parse(data)))
  .handler(async ({ data }) => {
    const { updateImportStatus } = await import("./mk9-checklist/persistence.server");
    await updateImportStatus(data.importId, {
      status: "cancelled",
      errorMessage: "Prévia descartada pelo usuário",
      finishedAt: new Date(),
    });
    return { ok: true };
  });

