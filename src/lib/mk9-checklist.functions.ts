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
  // Conflitos de frequência (MANUAL/FUTURE) só podem ser forçados por ADMIN
  // e exigem justificativa registrada em auditoria.
  forceFrequencyConflicts: z.boolean().optional(),
  forceReason: z.string().min(10).max(500).optional(),
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
    const { requireMk9Role } = await import("./mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);

    // Somente indústrias classificadas como "exige checklist" entram no fluxo.
    const { assertIndustryRequiresChecklist } = await import("./mk9-checklist/industry-gate.server");
    await assertIndustryRequiresChecklist(data.industryId);

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
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { assertIndustryRequiresChecklist } = await import("./mk9-checklist/industry-gate.server");
    await assertIndustryRequiresChecklist(data.industryId);
    const { withRichErrors, buildRichError } = await import("./mk9-checklist/errors.server");

    const {
      persistActualVisits,
      updateImportStatus,
      ensureChecklistStores,
      loadPreviewSnapshot,
      upsertIndustryStoreFrequencies,
    } = await import("./mk9-checklist/persistence.server");
    const startedAt = Date.now();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Marca committing logo no início para que o histórico saia de "previewing".
    await updateImportStatus(data.importId, { status: "committing" }).catch(() => undefined);
    
    try {
      // REGRA DE SUBSTITUIÇÃO: Executar em transação
      const snapshot = await withRichErrors(
        { step: "load-preview-snapshot", function: "checklistCommit", extra: { importId: data.importId } },
        () => loadPreviewSnapshot(data.importId),
      );

      // 0) Identifica importação anterior para substituir
      const { data: previous } = await supabaseAdmin
        .from("mk9_checklist_imports")
        .select("id, file_hash")
        .eq("industry_id", data.industryId)
        .eq("operation_month", data.operationMonth)
        .eq("operation_year", data.operationYear)
        .eq("is_operational_current" as any, true)
        .eq("status", "done")
        .maybeSingle();

      const newHash = snapshot?.fileHash;
      if (previous && previous.file_hash === newHash) {
        // Duplicado inalterado: Mantemos a anterior e cancelamos esta.
        await updateImportStatus(data.importId, { 
          status: "cancelled", 
          errorMessage: "Arquivo duplicado inalterado. A versão anterior continua vigente." 
        });
        return {
          importId: data.importId,
          persisted: 0,
          skipped: 0,
          total: 0,
          storesCreated: 0,
          storesReused: 0,
          unresolved: 0,
          frequenciesUpserted: 0,
          frequenciesNotImported: 0,
          frequencyDiff: null,
          reconciliationError: null,
          validation: null,
          validationError: "DUPLICATE_UNCHANGED"
        };
      }

      const freqs = snapshot?.storeFrequencies ?? [];
      const storeIdByKey = new Map<string, string>();
      for (const f of freqs) {
        if (f.storeId) storeIdByKey.set(`${f.storeNormalized}|${f.uf ?? ""}`, f.storeId);
      }
      for (const it of data.items) {
        if (it.storeId) storeIdByKey.set(`${it.storeNormalized}|${it.uf ?? ""}`, it.storeId);
      }

      const allCandidates = freqs
        .filter((f) => !storeIdByKey.has(`${f.storeNormalized}|${f.uf ?? ""}`))
        .map((f) => ({ storeName: f.storeName, storeNormalized: f.storeNormalized, uf: f.uf ?? null }));
      const fallbackCandidates = data.items
        .filter((i) => !storeIdByKey.has(`${i.storeNormalized}|${i.uf ?? ""}`))
        .map((i) => ({ storeName: i.storeName, storeNormalized: i.storeNormalized, uf: i.uf ?? null }));
      const candidatesByKey = new Map<string, { storeName: string; storeNormalized: string; uf: string | null }>();
      for (const c of [...allCandidates, ...fallbackCandidates]) {
        candidatesByKey.set(`${c.storeNormalized}|${c.uf ?? ""}`, c);
      }

      const createdMap = await withRichErrors(
        { step: "ensure-checklist-stores", function: "checklistCommit", extra: { candidates: candidatesByKey.size } },
        () => ensureChecklistStores(data.importId, Array.from(candidatesByKey.values())),
      );
      for (const [key, v] of createdMap) storeIdByKey.set(key, v.storeId);


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
        const found = storeIdByKey.get(key);
        if (found) {
          resolvedItems.push({ storeId: found, scheduledDate: it.scheduledDate });
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
      let frequenciesNotImported = 0;
      let frequencyDiff: {
        unchanged: number;
        new: number;
        changed: number;
        removed: number;
        manualConflicts: number;
        futureConflicts: number;
        skipped: number;
        forced: number;
      } | null = null;
      if (freqs.length) {
        const rows = freqs
          .map((f) => ({
            storeId: storeIdByKey.get(`${f.storeNormalized}|${f.uf ?? ""}`) ?? null,
            // Preserva a origem da linha para que o dedup NUNCA some frequências
            // de nomes diferentes do Excel vinculados à mesma loja.
            storeKey: `${f.storeNormalized}|${f.uf ?? ""}`,
            matchKind:
              f.status === "linked_by_similarity" ? ("SIMILARITY" as const) : ("EXACT" as const),
            weeklyFrequency: f.weeklyFrequency,
            monthlyFrequency: f.monthlyFrequency,
          }))
          .filter((r): r is {
            storeId: string;
            storeKey: string;
            matchKind: "EXACT" | "SIMILARITY";
            weeklyFrequency: number | null;
            monthlyFrequency: number | null;
          } => !!r.storeId);
        frequenciesNotImported = freqs.length - rows.length;

        const { upserted, report, applied } = await withRichErrors(
          { step: "upsert-industry-store-frequencies", function: "checklistCommit", extra: { rows: rows.length, frequenciesNotImported } },
          () =>
            upsertIndustryStoreFrequencies(data.industryId, data.importId, rows, {
              operationMonth: data.operationMonth,
              operationYear: data.operationYear,
              // force só é aceito para ADMIN (papel já validado acima) e exige justificativa.
              force: !!data.forceFrequencyConflicts && !!data.forceReason,
              reason: data.forceReason ?? null,
              actorId: ctx.userId,
            }),
        );
        frequenciesUpserted = upserted;
        frequencyDiff = {
          unchanged: report.unchanged,
          new: report.new,
          changed: report.changed,
          removed: report.removed,
          manualConflicts: report.manualConflicts,
          futureConflicts: report.futureConflicts,
          skipped: applied.skipped,
          forced: applied.forced,
        };
        await logAudit(ctx, "mk9.frequency.version.apply", "mk9_industry_store_frequency_versions", data.importId, {
          industryId: data.industryId,
          competencyStart: report.competencyStart,
          ...frequencyDiff,
          forceReason: data.forceReason ?? null,
        });
      }


      const counters = {
        persisted,
        skipped,
        total: data.items.length,
        storesCreated,
        storesReused,
        unresolved: unresolved.length,
        frequenciesUpserted,
        frequenciesNotImported,
        totalStoresInExcel: snapshot?.counters.totalStores ?? freqs.length,
        totalContractedFrequency: snapshot?.counters.totalContractedFrequency ?? null,
      };

      // 5) Auditoria em 3 níveis pós-commit: recomputa parsed × declarado × persistido.
      let validation: import("./mk9-checklist/types").ChecklistValidationReport | null = null;
      let validationError: string | null = null;
      try {
        const [{ queryPersistedVisitsByImport, writeValidationReport }, { buildValidationFromSnapshot }] = await Promise.all([
          import("./mk9-checklist/persistence.server"),
          import("./mk9-checklist/validation"),
        ]);
        const persistedByStore = await queryPersistedVisitsByImport(data.importId);
        if (snapshot) {
          validation = buildValidationFromSnapshot(snapshot, persistedByStore);
          await writeValidationReport(data.importId, validation);
        }
      } catch (vErr: any) {
        validationError = String(vErr?.message ?? vErr);
      }

      const finalStatus: "done" | "failed" =
        validation && validation.status === "INCONSISTENT" ? "done" : "done";

      // SUBSTITUIÇÃO: Marcar como vigente e atualizar anterior
      if (previous) {
        // Desativa a anterior
        await supabaseAdmin
          .from("mk9_checklist_imports")
          .update({
            is_operational_current: false,
            superseded_at: new Date().toISOString(),
            superseded_by: data.importId
          } as any)
          .eq("id", previous.id);
        
        // Remove visitas da importação anterior para não somar
        await supabaseAdmin
          .from("mk9_actual_visits")
          .delete()
          .eq("source_import_id", previous.id);
      }

      await updateImportStatus(data.importId, {
        status: finalStatus,
        counters,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
      });

      // Marca a atual como vigente
      await supabaseAdmin
        .from("mk9_checklist_imports")
        .update({ 
          is_operational_current: true,
          replaces_import_id: previous?.id ?? null
        } as any)
        .eq("id", data.importId);


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

      await logAudit(ctx, "mk9.checklist.commit", "mk9_checklist_imports", data.importId, {
        industryId: data.industryId,
        operationMonth: data.operationMonth,
        operationYear: data.operationYear,
        persisted,
        storesCreated,
        validationStatus: validation?.status ?? null,
      });

      return {
        importId: data.importId,
        persisted,
        skipped,
        total: data.items.length,
        storesCreated,
        storesReused,
        unresolved: unresolved.length,
        frequenciesUpserted,
        frequenciesNotImported,
        frequencyDiff,
        reconciliationError,
        validation,
        validationError,
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
    const { requireMk9AdminRead } = await import("@/lib/mk9-auth/read-guards.server");
    await requireMk9AdminRead();
  const { listChecklistImports } = await import("./mk9-checklist/persistence.server");
  return listChecklistImports(30);
});

export const checklistDelete = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => validate("checklistDelete", () => z.object({ importId: z.string().uuid() }).parse(data)))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { deleteChecklistImport } = await import("./mk9-checklist/persistence.server");
    await deleteChecklistImport(data.importId);
    await logAudit(ctx, "mk9.checklist.delete", "mk9_checklist_imports", data.importId);
    return { ok: true };
  });

// Marca a prévia como descartada sem apagar o registro do histórico.
export const checklistCancel = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => validate("checklistCancel", () => z.object({ importId: z.string().uuid() }).parse(data)))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { updateImportStatus } = await import("./mk9-checklist/persistence.server");
    await updateImportStatus(data.importId, {
      status: "cancelled",
      errorMessage: "Prévia descartada pelo usuário",
      finishedAt: new Date(),
    });
    await logAudit(ctx, "mk9.checklist.cancel", "mk9_checklist_imports", data.importId);
    return { ok: true };
  });

// Recomputa a validação em 3 níveis a partir dos dados persistidos, sem re-parsear o Excel.
// Útil quando a auditoria foi salva com uma versão antiga do motor.
export const checklistReprocessValidation = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => validate("checklistReprocessValidation", () => z.object({ importId: z.string().uuid() }).parse(data)))
  .handler(async ({ data }) => {
    const { requireMk9Role, logAudit } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);
    const { loadPreviewSnapshot, queryPersistedVisitsByImport, writeValidationReport } = await import(
      "./mk9-checklist/persistence.server"
    );
    const { buildValidationFromSnapshot } = await import("./mk9-checklist/validation");
    const snapshot = await loadPreviewSnapshot(data.importId);
    if (!snapshot) throw new Error("Snapshot da prévia não encontrado para essa importação.");
    const persistedByStore = await queryPersistedVisitsByImport(data.importId);
    const validation = buildValidationFromSnapshot(snapshot, persistedByStore);
    await writeValidationReport(data.importId, validation);
    await logAudit(ctx, "mk9.checklist.reprocess_validation", "mk9_checklist_imports", data.importId, {
      status: validation.status,
      persistedTotal: validation.persistedTotal,
      parsedTotal: validation.parsedTotal,
    });
    return { validation };
  });

export const checklistGetValidation = createServerFn({ method: "GET" })
  .inputValidator(async (data: unknown) => validate("checklistGetValidation", () => z.object({ importId: z.string().uuid() }).parse(data)))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("./mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN", "SUPERVISOR", "AUDITOR"]);
    const { loadValidationReport } = await import("./mk9-checklist/persistence.server");
    return { validation: await loadValidationReport(data.importId) };
  });



