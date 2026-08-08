import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  industryId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  uf: z.string().trim().min(1).max(2).nullish(),
  storeId: z.string().uuid().nullish(),
  checklistImportId: z.string().uuid().nullish(),
  sourceImportId: z.string().uuid().nullish(),
});

function errorResponse(
  status: number,
  payload: {
    stage: string;
    message: string;
    stack?: string;
    industryId?: string | null;
    period?: unknown;
  },
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/reports/industry-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let stage = "parse-payload";
        let access: import("@/lib/mk9-auth/access-scope.server").Mk9AccessScope | null = null;
        let industryId: string | null = null;
        let period: { month?: number; year?: number } = {};
        try {
          stage = "authorize";
          try {
            const { requireMk9ReportsScope } = await import("@/lib/mk9-auth/read-guards.server");
            const resolved = await requireMk9ReportsScope(request);
            access = resolved.scope;
          } catch (authError) {
            const status = (authError as any)?.statusCode === 403 ? 403 : 401;
            return errorResponse(status, {
              stage: "authorize",
              message: authError instanceof Error ? authError.message : "Não autorizado.",
            });
          }

          stage = "parse-payload";
          const raw = await request.json();
          const body = payloadSchema.parse(raw);
          industryId = body.industryId;
          period = { month: body.month, year: body.year };

          stage = "load-server-modules";
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { loadPeriodConfig, resolveWindow } =
            await import("@/lib/mk9-reports/period.server");
          const { buildIndustryReport } = await import("@/lib/mk9-reports/industry-report.server");
          const { renderIndustryReportPdf, industryPdfFileName } =
            await import("@/lib/reports/industry-pdf.server");

          stage = "resolve-period";
          const { assertIndustryAllowed } = await import("@/lib/mk9-auth/access-scope.server");
          assertIndustryAllowed(access!, body.industryId);
          const cfg = await loadPeriodConfig(supabaseAdmin, body.industryId);
          const window = resolveWindow(cfg, body.year, body.month);

          stage = "build-report-data";
          const sourceImportId = body.checklistImportId ?? body.sourceImportId ?? null;
          const report = await buildIndustryReport(
            supabaseAdmin,
            {
              industryId: body.industryId,
              year: body.year,
              month: body.month,
              uf: body.uf ?? null,
              storeId: body.storeId ?? null,
              sourceImportId,
              access,
            },
            window,
          );

          stage = "render-pdf";
          const bytes = await renderIndustryReportPdf(report, body.year, body.month);
          const filename = industryPdfFileName(report, body.year, body.month);
          const ab = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer;
          return new Response(ab, {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `attachment; filename="${filename}"`,
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          if ((error as any)?.statusCode === 403) {
            return errorResponse(403, { stage: "authorize", message: "FORBIDDEN" });
          }
          // Log completo fica no servidor; a resposta nunca expõe stack, SQL ou caminho interno.
          console.error("[industry-pdf]", { stage, industryId, period, error: err });
          if (stage === "parse-payload") {
            return errorResponse(400, { stage: "request", message: "INVALID_REQUEST" });
          }
          return errorResponse(500, { stage: "internal", message: "INTERNAL_ERROR" });
        }
      },
    },
  },
});
