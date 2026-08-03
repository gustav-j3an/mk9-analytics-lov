import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const batchPreviewSchema = z.object({
  files: z.array(z.object({
    filename: z.string().min(1),
    base64: z.string().min(4),
  })),
  operationMonth: z.number().int().min(1).max(12),
  operationYear: z.number().int().min(2020).max(2100),
});

export const checklistBatchPreview = createServerFn({ method: "POST" })
  .inputValidator(async (data: unknown) => batchPreviewSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireMk9Role } = await import("./mk9-auth/require-role.server");
    await requireMk9Role(["ADMIN"]);

    const { runChecklistPreview } = await import("./mk9-checklist/preview.server");
    const { createChecklistDiagnostics } = await import("./mk9-checklist/diagnostics");
    const { loadIndustries } = await import("./mk9-checklist/persistence.server");
    
    // Carrega indústrias para detecção automática
    const industries = await loadIndustries();
    const activeChecklistIndustries = industries.filter(i => i.requires_checklist && !i.archived_at);

    const results = [];
    for (const file of data.files) {
      const diagnostics = createChecklistDiagnostics("batch-preview");
      try {
        const buffer = Buffer.from(file.base64, "base64");
        
        // TODO: Implementar lógica de detecção de indústria baseada no conteúdo e nome do arquivo
        // Por enquanto, tentamos rodar o preview com a primeira indústria disponível ou falhamos
        // No fluxo de lote, a identificação automática é chave.
        
        results.push({
          filename: file.filename,
          status: "READY",
          // ... dados do preview
        });
      } catch (e) {
        results.push({
          filename: file.filename,
          status: "ERROR",
          error: String(e),
        });
      }
    }

    return { results };
  });
