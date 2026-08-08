import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  industryId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  uf: z.string().trim().min(1).max(2).nullish(),
  supervisorId: z.string().uuid().nullish(),
  promoterId: z.string().uuid().nullish(),
});

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/reports/industry-unattended-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { requireMk9ReportsScope } = await import("@/lib/mk9-auth/read-guards.server");
          const { scope: access } = await requireMk9ReportsScope(request);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { loadPeriodConfig, resolveWindow } =
            await import("@/lib/mk9-reports/period.server");
          const { buildIndustryReport } = await import("@/lib/mk9-reports/industry-report.server");
          const { renderUnattendedPdf, unattendedPdfFileName } =
            await import("@/lib/reports/unattended-pdf.server");

          const raw = await request.json();
          const body = payloadSchema.parse(raw);

          const { assertIndustryAllowed } = await import("@/lib/mk9-auth/access-scope.server");
          assertIndustryAllowed(access, body.industryId);

          const cfg = await loadPeriodConfig(supabaseAdmin, body.industryId);
          const window = resolveWindow(cfg, body.year, body.month);

          const report = await buildIndustryReport(
            supabaseAdmin,
            {
              industryId: body.industryId,
              year: body.year,
              month: body.month,
              uf: body.uf ?? null,
              access,
            },
            window,
          );

          const bytes = await renderUnattendedPdf(report, body.year, body.month);
          const filename = unattendedPdfFileName(report, body.year, body.month);

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
          console.error("[unattended-pdf]", error);
          const status = (error as any)?.statusCode || 500;
          return errorResponse(status, error instanceof Error ? error.message : "INTERNAL_ERROR");
        }
      },
    },
  },
});
