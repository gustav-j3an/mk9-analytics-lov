import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireMk9ReadScope } from "@/lib/mk9-auth/read-guards.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderPromoterRoutePdf, promoterPdfFileName } from "@/lib/reports/promoter-pdf.server";

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
        const requestId = Math.random().toString(36).substring(7);
        let step = "request-received";
        
        const log = (msg: string, data?: any) => {
          console.log(`[PDF_EXPORT][${requestId}][${step}] ${msg}`, data ? JSON.stringify(data) : "");
        };

        try {
          log("Início da requisição");
          
          step = "auth-start";
          const { scope: access } = await requireMk9ReadScope(request);
          log("Auth OK", { userId: access.userId });
          
          step = "params-parse";
          const raw = await request.json();
          const body = payloadSchema.parse(raw);
          const promoterId = body.promoterId;
          const referenceDate = `${body.year}-${String(body.month).padStart(2, '0')}-01`;
          log("Params OK", { promoterId, referenceDate });

          step = "db-load-route";
          const { data: rows, error: routeError } = await supabaseAdmin
            .from("mk9_planned_routes")
            .select(`
              id, 
              weekday, 
              valid_from, 
              valid_until, 
              is_active,
              store:mk9_stores(id, name, chain, uf),
              industry:mk9_industries(id, name)
            `)
            .eq("promoter_id", body.promoterId)
            .eq("is_active", true)
            .is("archived_at", null)
            .lte("valid_from", referenceDate)
            .or(`valid_until.is.null,valid_until.gte.${referenceDate}`)
            .order("weekday", { ascending: true });

          if (routeError) {
            log("DB Error", routeError);
            throw routeError;
          }

          if (!rows || rows.length === 0) {
            step = "no-routes";
            return errorResponse(404, "Nenhum roteiro vigente encontrado para este promotor.");
          }

          const routes = rows.map((r: any) => ({
            id: r.id as string,
            weekday: r.weekday as number,
            storeId: r.store?.id ?? null,
            storeName: r.store?.name ?? "—",
            storeChain: r.store?.chain ?? null,
            storeUf: r.store?.uf ?? null,
            storeAddress: null, // Coluna 'address' não existe na tabela mk9_stores
            industryName: r.industry?.name ?? "—",
          }));
          log("Route Loaded", { count: routes.length });

          step = "db-load-promoter";
          const { data: promoter } = await supabaseAdmin
            .from("mk9_promoters")
            .select("name, employee_number")
            .eq("id", body.promoterId)
            .maybeSingle();
          log("Promoter Loaded", { name: promoter?.name });

          step = "renderer-start";
          log("Starting render...");
          const bytes = await renderPromoterRoutePdf({
            routes,
            promoterName: promoter?.name ?? "Promotor",
            referenceDate,
          });
          log("Renderer Complete", { byteLength: bytes?.length });

          step = "response-prepare";
          const filename = promoterPdfFileName(promoter?.name ?? "Promotor");
          const ab = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer;

          log("Sending Response", { filename, byteLength: ab.byteLength });
          return new Response(ab, {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `attachment; filename="${filename}"`,
              "cache-control": "no-store",
            },
          });
        } catch (error: any) {
          log("FATAL ERROR", { 
            name: error?.name, 
            message: error?.message, 
            stack: error?.stack,
            step 
          });
          
          return new Response(JSON.stringify({
            error: "PDF_EXPORT_FAILED",
            step,
            message: error instanceof Error ? error.message : "INTERNAL_ERROR",
            requestId,
          }), {
            status: 500,
            headers: { "content-type": "application/json" }
          });
        }
      },

    },
  },
});
