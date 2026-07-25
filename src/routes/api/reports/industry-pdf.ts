// Rota HTTP que devolve o PDF do Relatório da Indústria.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/reports/industry-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as {
            industryId: string;
            year: number;
            month: number;
            uf?: string | null;
            storeId?: string | null;
            sourceImportId?: string | null;
          };
          if (!body?.industryId || !body?.year || !body?.month) {
            return new Response(JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }), { status: 400, headers: { "content-type": "application/json" } });
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { loadPeriodConfig, resolveWindow } = await import("@/lib/mk9-reports/period.server");
          const { buildIndustryReport } = await import("@/lib/mk9-reports/industry-report.server");
          const { renderIndustryReportPdf, pdfFileName } = await import("@/lib/mk9-reports/pdf.server");
          const cfg = await loadPeriodConfig(supabaseAdmin, body.industryId);
          const window = resolveWindow(cfg, body.year, body.month);
          const report = await buildIndustryReport(supabaseAdmin, {
            industryId: body.industryId, year: body.year, month: body.month,
            uf: body.uf ?? null, storeId: body.storeId ?? null, sourceImportId: body.sourceImportId ?? null,
          }, window);
          const bytes = await renderIndustryReportPdf(report);
          const filename = pdfFileName(report, body.year, body.month);
          return new Response(bytes, {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `attachment; filename="${filename}"`,
              "cache-control": "no-store",
            },
          });
        } catch (e: any) {
          const msg = e?.message ?? String(e);
          return new Response(JSON.stringify({ error: msg, stack: e?.stack }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
