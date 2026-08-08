import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const batchPreviewSchema = z.object({
  files: z.array(
    z.object({
      filename: z.string().min(1),
      base64: z.string().min(4),
    }),
  ),
  operationMonth: z.number().int().min(1).max(12),
  operationYear: z.number().int().min(2020).max(2100),
});

export const checklistBatchPreview = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => batchPreviewSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("./mk9-auth/require-role.server");
    const ctx = await requireMk9Role(["ADMIN"]);

    const { runChecklistPreview } = await import("./mk9-checklist/preview.server");
    const { createChecklistDiagnostics } = await import("./mk9-checklist/diagnostics");
    const { listIndustries, createBatch, updateBatchStatus } =
      await import("./mk9-checklist/batch.server");

    const industries = await listIndustries();
    const batch = await createBatch(ctx.userId || "");
    await updateBatchStatus(batch.id, "ANALYZING");

    const results = [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (const file of data.files) {
      const diagnostics = createChecklistDiagnostics("batch-preview");
      try {
        const buffer = Buffer.from(file.base64, "base64");

        // Detecção simplificada: tenta encontrar o nome da indústria no nome do arquivo
        const filenameLower = file.filename.toLowerCase();
        const matchedIndustry = industries.find((i) =>
          filenameLower.includes(i.name.toLowerCase()),
        );

        if (matchedIndustry) {
          const res = await runChecklistPreview(
            {
              buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
              filename: file.filename,
              fileSize: buffer.byteLength,
              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              industryId: matchedIndustry.id,
              operationMonth: data.operationMonth,
              operationYear: data.operationYear,
            },
            diagnostics,
          );

          // Vincula o import individual ao batch
          await (supabaseAdmin as any)
            .from("mk9_checklist_imports")
            .update({ batch_id: batch.id })
            .eq("id", res.importId);

          results.push({
            importId: res.importId,
            filename: file.filename,
            status: "READY",
            industryId: matchedIndustry.id,
            industryName: matchedIndustry.name,
            preview: res.preview,
          });
        } else {
          // Quando a indústria não é identificada, criamos o registro de importação como 'failed'
          // mas com o status NEEDS_REVIEW para a UI, permitindo auditoria futura se necessário.
          results.push({
            filename: file.filename,
            status: "NEEDS_REVIEW",
            message:
              "Indústria não identificada pelo nome do arquivo. Verifique se o nome do arquivo contém o nome exato da indústria cadastrada.",
          });
        }
      } catch (e: any) {
        results.push({
          filename: file.filename,
          status: "ERROR",
          error: e?.message ?? String(e),
        });
      }
    }

    const hasErrors = results.some((r) => r.status === "ERROR");
    const hasNeedsReview = results.some((r) => r.status === "NEEDS_REVIEW");

    let finalStatus: "READY" | "PARTIAL" | "FAILED" = "READY";
    if (hasErrors) finalStatus = "FAILED";
    else if (hasNeedsReview) finalStatus = "PARTIAL";

    await updateBatchStatus(batch.id, finalStatus);
    return { batchId: batch.id, results };
  });
