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

const commitSchema = z.object({
  importId: z.string().uuid(),
  industryId: z.string().uuid(),
  operationMonth: z.number().int().min(1).max(12),
  operationYear: z.number().int().min(2020).max(2100),
  items: z.array(
    z.object({
      storeId: z.string().uuid(),
      scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ),
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
    diagnostics.info("request-received", "Requisição recebida via server function legado", {
      filename: data.filename,
      base64Length: data.base64.length,
      parser: "parseChecklistWorkbook",
    });
    return runChecklistPreview(
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
  });

export const checklistCommit = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => validate("checklistCommit", () => commitSchema.parse(data)))
  .handler(async ({ data }) => {
    const { withRichErrors, buildRichError } = await import("./mk9-checklist/errors.server");
    const { persistActualVisits, updateImportStatus } = await import("./mk9-checklist/persistence.server");
    const startedAt = Date.now();
    try {
      const { persisted, skipped } = await withRichErrors(
        { step: "persist-actual-visits", function: "checklistCommit", extra: { importId: data.importId, count: data.items.length } },
        () => persistActualVisits(data.importId, data.industryId, data.items),
      );
      await updateImportStatus(data.importId, {
        status: "done",
        counters: { persisted, skipped, total: data.items.length },
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
      return { importId: data.importId, persisted, skipped, total: data.items.length, reconciliationError };
    } catch (e: any) {
      // Já vem estruturado (JSON string) do withRichErrors — persiste no histórico
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
      // Se não veio estruturado, estruturar agora
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
