import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  promoterId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/reports/promoter-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
          const { scope: access } = await requireMk9ReadScope(request);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const raw = await request.json();
          const body = payloadSchema.parse(raw);

          // DADOS DO ROTEIRO: Usar a mesma fonte da tela de Roteiros
          const { loadPromoterRouteForDisplay } = await import("@/lib/reports/promoter-route-loader.functions");
          const routes = await loadPromoterRouteForDisplay({
            data: {
              promoterId: body.promoterId,
              referenceDate: `${body.year}-${String(body.month).padStart(2, '0')}-01` // Usar o primeiro dia do mês/ano solicitado, ou considerar passar a data exata se necessário
            }
          });

          if (!routes || routes.length === 0) {
            return errorResponse(404, "Nenhum roteiro vigente encontrado para este promotor.");
          }

          const { renderPromoterRoutePdf, promoterPdfFileName } =
            await import("@/lib/reports/promoter-pdf.server");

          // Busca o nome do promotor
          const { data: promoter } = await supabaseAdmin
            .from("mk9_promoters")
            .select("name, employee_number")
            .eq("id", body.promoterId)
            .maybeSingle();

          const bytes = await renderPromoterRoutePdf({
            routes,
            promoterName: promoter?.name ?? "Promotor",
            referenceDate: `${body.year}-${String(body.month).padStart(2, '0')}-01`,
          });

          const filename = promoterPdfFileName(promoter?.name ?? "Promotor");
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
          console.error("[promoter-pdf]", error);
          const status = (error as any)?.statusCode || 500;
          return errorResponse(status, error instanceof Error ? error.message : "INTERNAL_ERROR");
        }
      },
    },
  },
});
