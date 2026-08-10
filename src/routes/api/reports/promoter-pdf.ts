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
        let step = "A. request received";
        try {
          console.log("[promoter-pdf] Starting export process...");
          
          step = "B. auth resolved";
          const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
          const { scope: access } = await requireMk9ReadScope(request);
          console.log("[promoter-pdf] Auth OK");

          step = "C. input parsing";
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const raw = await request.json();
          console.log("[promoter-pdf] Payload:", raw);
          const body = payloadSchema.parse(raw);
          console.log("[promoter-pdf] Promoter ID:", body.promoterId);

          step = "E. route data loading";
          const refDateStr = `${body.year}-${String(body.month).padStart(2, '0')}-01`;
          console.log("[promoter-pdf] Reference date:", refDateStr);
          
          const { data: rows, error: routeError } = await supabaseAdmin
            .from("mk9_planned_routes")
            .select(`
              id, 
              weekday, 
              valid_from, 
              valid_until, 
              is_active,
              promoter:mk9_promoters(id, name),
              store:mk9_stores(id, name, chain, uf, address),
              industry:mk9_industries(id, name)
            `)
            .eq("promoter_id", body.promoterId)
            .eq("is_active", true)
            .is("archived_at", null)
            .lte("valid_from", refDateStr)
            .or(`valid_until.is.null,valid_until.gte.${refDateStr}`)
            .order("weekday", { ascending: true });

          if (routeError) {
            console.error("[promoter-pdf] DB Error:", routeError);
            throw routeError;
          }

          const routes = (rows ?? []).map((r: any) => ({
            id: r.id as string,
            weekday: r.weekday as number,
            validFrom: r.valid_from as string,
            validUntil: (r.valid_until as string | null) ?? null,
            isActive: r.is_active as boolean,
            promoterId: r.promoter?.id ?? null,
            promoterName: r.promoter?.name ?? "—",
            storeId: r.store?.id ?? null,
            storeName: r.store?.name ?? "—",
            storeChain: r.store?.chain ?? null,
            storeUf: r.store?.uf ?? null,
            storeAddress: r.store?.address ?? null,
            industryId: r.industry?.id ?? null,
            industryName: r.industry?.name ?? "—",
          }));

          console.log("[promoter-pdf] Routes found:", routes.length);

          if (!routes || routes.length === 0) {
            return errorResponse(404, "Nenhum roteiro vigente encontrado para este promotor.");
          }

          step = "F. PDF renderer started";
          const { renderPromoterRoutePdf, promoterPdfFileName } =
            await import("@/lib/reports/promoter-pdf.server");

          // Busca o nome do promotor
          const { data: promoter } = await supabaseAdmin
            .from("mk9_promoters")
            .select("name, employee_number")
            .eq("id", body.promoterId)
            .maybeSingle();

          console.log("[promoter-pdf] Calling renderPromoterRoutePdf...");
          
          step = "G. PDF bytes generated";
          const bytes = await renderPromoterRoutePdf({
            routes,
            promoterName: promoter?.name ?? "Promotor",
            referenceDate: refDateStr,
          });

          console.log("[promoter-pdf] PDF generated, byteLength:", bytes.byteLength);

          step = "H. response returned";
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
          console.error(`[promoter-pdf] Error at step: ${step}`, error);
          const status = (error as any)?.statusCode || 500;
          return errorResponse(
            status, 
            `[${step}] ${error instanceof Error ? error.message : "INTERNAL_ERROR"}`
          );
        }
      },
    },
  },
});
