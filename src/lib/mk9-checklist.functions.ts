// RPCs do módulo Importador de Checklists.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ChecklistItem, ChecklistPreview } from "./mk9-checklist/types";

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

function b64ToArrayBuffer(base64: string): ArrayBuffer {
  const bin = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export const checklistPreview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => previewSchema.parse(data))
  .handler(async ({ data }) => {
    const { parseChecklistWorkbook } = await import("./mk9-checklist/parser");
    const {
      loadIndustry,
      loadStoresIndex,
      createChecklistImport,
      savePreviewSnapshot,
      updateImportStatus,
    } = await import("./mk9-checklist/persistence.server");

    const industry = await loadIndustry(data.industryId);
    const parsed = parseChecklistWorkbook(b64ToArrayBuffer(data.base64), data.filename);

    if (parsed.marks.length === 0 && parsed.stores.length === 0) {
      throw new Error("Planilha vazia ou fora do modelo esperado (não achamos cabeçalho de lojas + dias).");
    }

    const stores = await loadStoresIndex();
    const maxDay = daysInMonth(data.operationYear, data.operationMonth);

    const items: ChecklistItem[] = [];
    const storesSeen = new Set<string>();
    const storesFound = new Set<string>();
    const storesNotFound = new Set<string>();

    for (const mark of parsed.marks) {
      const key = `${mark.storeNormalized}|${mark.uf ?? ""}`;
      storesSeen.add(key);
      const match =
        stores.byKey.get(key) ??
        (mark.uf ? stores.byName.get(mark.storeNormalized) : stores.byName.get(mark.storeNormalized));

      const dateStr =
        mark.day >= 1 && mark.day <= maxDay
          ? `${data.operationYear}-${pad2(data.operationMonth)}-${pad2(mark.day)}`
          : "";

      if (!match) {
        storesNotFound.add(key);
        items.push({
          excelRow: mark.excelRow,
          storeName: mark.storeName,
          uf: mark.uf,
          storeId: null,
          scheduledDate: dateStr,
          status: "store_not_found",
          message: "Loja não localizada na base MK9",
        });
        continue;
      }
      storesFound.add(key);

      if (!dateStr) {
        items.push({
          excelRow: mark.excelRow,
          storeName: mark.storeName,
          uf: mark.uf,
          storeId: match.id,
          scheduledDate: "",
          status: "invalid_date",
          message: `Dia ${mark.day} inválido para ${pad2(data.operationMonth)}/${data.operationYear}`,
        });
        continue;
      }

      items.push({
        excelRow: mark.excelRow,
        storeName: mark.storeName,
        uf: mark.uf,
        storeId: match.id,
        scheduledDate: dateStr,
        status: "found",
      });
    }

    // Considera também as lojas listadas na planilha (mesmo sem marcações) para o contador
    for (const s of parsed.stores) {
      const key = `${s.storeNormalized}|${s.uf ?? ""}`;
      storesSeen.add(key);
      const match = stores.byKey.get(key) ?? stores.byName.get(s.storeNormalized);
      if (match) storesFound.add(key);
      else storesNotFound.add(key);
    }

    const validDates = items.filter((i) => i.status === "found").length;
    const invalidDates = items.filter((i) => i.status === "invalid_date").length;

    const preview: ChecklistPreview = {
      filename: data.filename,
      industryId: industry.id,
      industryName: industry.name,
      operationMonth: data.operationMonth,
      operationYear: data.operationYear,
      counters: {
        totalStores: storesSeen.size,
        totalMarks: parsed.marks.length,
        storesFound: storesFound.size,
        storesNotFound: storesNotFound.size,
        validDates,
        invalidDates,
      },
      items,
      warnings: parsed.warnings,
    };

    const { id: importId } = await createChecklistImport({
      filename: data.filename,
      industryId: industry.id,
      operationMonth: data.operationMonth,
      operationYear: data.operationYear,
    });
    await savePreviewSnapshot(importId, preview);
    await updateImportStatus(importId, { status: "previewing", counters: { ...preview.counters } });

    return { importId, preview };
  });

export const checklistCommit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => commitSchema.parse(data))
  .handler(async ({ data }) => {
    const { persistActualVisits, updateImportStatus } = await import("./mk9-checklist/persistence.server");
    const startedAt = Date.now();
    try {
      const { persisted, skipped } = await persistActualVisits(
        data.importId,
        data.industryId,
        data.items,
      );
      await updateImportStatus(data.importId, {
        status: "done",
        counters: { persisted, skipped, total: data.items.length },
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
      });
      // Executa conciliação automaticamente para o período/indústria
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
      await updateImportStatus(data.importId, {
        status: "failed",
        errorMessage: e?.message ?? String(e),
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
      });
      throw e;
    }
  });

export const checklistList = createServerFn({ method: "GET" }).handler(async () => {
  const { listChecklistImports } = await import("./mk9-checklist/persistence.server");
  return listChecklistImports(30);
});

export const checklistDelete = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ importId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteChecklistImport } = await import("./mk9-checklist/persistence.server");
    await deleteChecklistImport(data.importId);
    return { ok: true };
  });
