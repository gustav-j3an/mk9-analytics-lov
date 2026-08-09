import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const commitBatchSchema = z.object({
  batchId: z.string().uuid(),
  importIds: z.array(z.string().uuid()),
});

export const checklistBatchCommit = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => commitBatchSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("./mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);

    const { internalChecklistCommit } = await import("./mk9-checklist.functions");
    const { updateBatchStatus } = await import("./mk9-checklist/batch.server");
    const { loadPreviewSnapshot } = await import("./mk9-checklist/persistence.server");

    await updateBatchStatus(data.batchId, "PROCESSING");

    const results = [];
    for (const importId of data.importIds) {
      try {
        const preview = await loadPreviewSnapshot(importId);
        if (!preview) throw new Error("Preview não encontrado");

        // Regra de Filtro Operacional MK9:
        // Apenas itens resolvidos (found, similarity, new_store) com data válida
        // seguem para o commit.
        const items = preview.items
          .filter(
            (i: any) =>
              (i.status === "found" ||
                i.status === "linked_by_similarity" ||
                i.status === "new_store") &&
              i.scheduledDate,
          )
          .map((i: any) => ({
            storeId: i.storeId,
            storeName: i.storeName,
            storeNormalized: i.storeNormalized,
            uf: i.uf,
            scheduledDate: i.scheduledDate,
            isNew: i.status === "new_store",
          }));

        // Executa commit individual REAL (não apenas persistência)
        // Isso garante ativação da flag is_operational_current e substituição de versões.
        const res = await internalChecklistCommit({ userId: null, email: null, roles: ["ADMIN"], devBypass: true }, {
          importId,

          industryId: preview.industryId,
          operationMonth: preview.operationMonth,
          operationYear: preview.operationYear,
          items,
          forceFrequencyConflicts: true,
          forceReason: "Batch Import Propagation"
        });



        results.push({ importId, status: "SUCCESS", data: res });
      } catch (e: any) {
        results.push({ importId, status: "FAILED", error: e?.message ?? String(e) });
      }
    }

    const allSuccess = results.every((r) => r.status === "SUCCESS");
    await updateBatchStatus(data.batchId, allSuccess ? "COMPLETED" : "PARTIAL");

    return { results };
  });
