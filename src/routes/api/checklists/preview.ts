import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createChecklistDiagnostics } from "@/lib/mk9-checklist/diagnostics";

const formSchema = z.object({
  industryId: z.string().uuid(),
  operationMonth: z.coerce.number().int().min(1).max(12),
  operationYear: z.coerce.number().int().min(2020).max(2100),
});

async function parseStructuredError(
  error: unknown,
  step: string,
  diagnostics: ReturnType<typeof createChecklistDiagnostics>,
) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === "object" && parsed.__mk9Error) {
        return {
          ...parsed,
          step: parsed.step ?? step,
          stack: parsed.stack ?? error.stack,
          extra: { ...(parsed.extra ?? {}), diagnostics: diagnostics.events },
        };
      }
    } catch {}
  }
  const { buildRichError } = await import("@/lib/mk9-checklist/errors.server");
  return buildRichError(error, {
    step,
    function: "checklistPreviewMultipart",
    extra: { diagnostics: diagnostics.events },
  });
}

export const Route = createFileRoute("/api/checklists/preview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const diagnostics = createChecklistDiagnostics("preview-multipart");
        try {
          try {
            const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
            await requireMk9Role(["ADMIN"], { request });
          } catch (authError) {
            const status = (authError as any)?.statusCode === 403 ? 403 : 401;
            return Response.json(
              {
                error: {
                  __mk9Error: true,
                  step: "authorize",
                  message: authError instanceof Error ? authError.message : "Não autorizado.",
                },
              },
              { status },
            );
          }
          const contentType = request.headers.get("content-type") ?? "";
          diagnostics.info("request-received", "Requisição recebida no endpoint correto", {
            method: request.method,
            url: request.url,
            contentType,
            expectedContentType: "multipart/form-data",
          });

          if (!contentType.toLowerCase().includes("multipart/form-data")) {
            throw new Error(
              `Content-Type inválido: ${contentType || "(vazio)"}. Esperado multipart/form-data.`,
            );
          }

          diagnostics.info("read-form-data", "Lendo multipart/form-data", {});
          const form = await request.formData();
          const filePart = form.get("file");
          const fields = formSchema.parse({
            industryId: form.get("industryId"),
            operationMonth: form.get("operationMonth"),
            operationYear: form.get("operationYear"),
          });

          // Trava servidora: indústria precisa estar classificada como "exige checklist".
          const { assertIndustryRequiresChecklist } =
            await import("@/lib/mk9-checklist/industry-gate.server");
          try {
            await assertIndustryRequiresChecklist(fields.industryId);
          } catch (gateError) {
            const { INDUSTRY_CHECKLIST_DISABLED, INDUSTRY_CHECKLIST_DISABLED_MESSAGE } =
              await import("@/lib/mk9-checklist/industry-gate");
            return Response.json(
              {
                error: {
                  __mk9Error: true,
                  step: "industry-gate",
                  code: INDUSTRY_CHECKLIST_DISABLED,
                  industryId: fields.industryId,
                  message: INDUSTRY_CHECKLIST_DISABLED_MESSAGE,
                },
              },
              { status: 422 },
            );
          }

          if (!(filePart instanceof File)) {
            throw new Error("Arquivo não chegou ao backend no campo multipart 'file'.");
          }

          const filename = filePart.name || "checklist.xlsx";
          const mimeType = filePart.type || "";
          const fileSize = filePart.size;
          diagnostics.info("file-received", "Arquivo recebido pelo backend", {
            filename,
            fileSize,
            mimeType: mimeType || "(não informado)",
          });

          if (fileSize <= 0) throw new Error("Arquivo chegou vazio ao backend.");

          diagnostics.info("read-file-buffer", "Convertendo arquivo para ArrayBuffer", {
            filename,
            fileSize,
          });
          const buffer = await filePart.arrayBuffer();
          diagnostics.info("file-buffer-ready", "Arquivo disponível para o parser", {
            byteLength: buffer.byteLength,
          });

          const { runChecklistPreview } = await import("@/lib/mk9-checklist/preview.server");
          const result = await runChecklistPreview(
            {
              buffer,
              filename,
              fileSize,
              mimeType,
              industryId: fields.industryId,
              operationMonth: fields.operationMonth,
              operationYear: fields.operationYear,
            },
            diagnostics,
          );

          return Response.json(result);
        } catch (error) {
          const step = diagnostics.getCurrentStep();
          diagnostics.error(step, "Exceção capturada no endpoint de checklist", {
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : typeof error,
          });
          const payload = await parseStructuredError(error, step, diagnostics);
          return Response.json(
            { error: payload, diagnostics: diagnostics.events },
            { status: 500 },
          );
        }
      },
    },
  },
});
