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
        const requestId = Math.random().toString(36).substring(7);
        let currentStep = "STEP 1 = request";
        let promoterId = "unknown";
        let referenceDate = "unknown";
        let promoterName = "unknown";
        let routeItemsCount = 0;
        let pdfMinimalStatus = "PENDING";
        let pdfSimpleStatus = "PENDING";
        let pdfCompleteStatus = "PENDING";
        
        const log = (msg: string, data?: any) => {
          console.log(`[DIAG_PDF][${requestId}][${currentStep}] ${msg}`, data ? JSON.stringify(data) : "");
        };

        try {
          log("Início do diagnóstico");
          
          currentStep = "STEP 2 = auth";
          const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
          const { scope: access } = await requireMk9ReadScope(request);
          log("Auth OK", { userId: access.userId });
          
          currentStep = "STEP 3 = params";
          const raw = await request.json();
          const body = payloadSchema.parse(raw);
          promoterId = body.promoterId;
          referenceDate = `${body.year}-${String(body.month).padStart(2, '0')}-01`;
          log("Params OK", { promoterId, referenceDate });

          currentStep = "STEP 4 = load promoter";
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: promoter, error: pErr } = await supabaseAdmin
            .from("mk9_promoters")
            .select("name, employee_number")
            .eq("id", body.promoterId)
            .maybeSingle();
          if (pErr) throw pErr;
          promoterName = promoter?.name ?? "NÃO ENCONTRADO";
          log("Promoter Loaded", { name: promoterName });

          currentStep = "STEP 5 = load route";
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
            // A regra do PDF costuma usar uma data específica. O prompt diz 2026-08-10.
            // Aqui estamos pegando as vigentes na competência do mês.
            .lte("valid_from", referenceDate)
            .or(`valid_until.is.null,valid_until.gte.${referenceDate}`)
            .order("weekday", { ascending: true });

          if (routeError) throw routeError;
          routeItemsCount = rows?.length ?? 0;
          log("Route Loaded", { count: routeItemsCount });

          currentStep = "STEP 6 = normalize route";
          const routes = (rows ?? []).map((r: any) => ({
            id: r.id,
            weekday: r.weekday,
            storeId: r.store?.id,
            storeName: r.store?.name ?? "—",
            storeChain: r.store?.chain,
            storeUf: r.store?.uf,
            storeAddress: r.store?.address,
            industryName: r.industry?.name ?? "—",
          }));
          log("Normalization OK");

          currentStep = "STEP 7 = pdf create";
          const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
          const pdfDoc = await PDFDocument.create();
          log("PDF Create OK");

          currentStep = "STEP 8 = font load";
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          log("Fonts Embedded OK");

          currentStep = "STEP 9 = draw content (MINIMAL)";
          const pageTest = pdfDoc.addPage([200, 200]);
          pageTest.drawText("TESTE DIAGNOSTICO", { x: 50, y: 100, size: 10, font });
          const minBytes = await pdfDoc.save();
          pdfMinimalStatus = minBytes.length > 0 ? "OK" : "ERRO (EMPTY)";
          log("Minimal PDF Test OK", { byteLength: minBytes.length });

          currentStep = "STEP 9 = draw content (SIMPLE LIST)";
          // Reset doc para teste simples com dados reais
          const simpleDoc = await PDFDocument.create();
          const simpleFont = await simpleDoc.embedFont(StandardFonts.Helvetica);
          const pageSimple = simpleDoc.addPage([595, 842]);
          let y = 800;
          pageSimple.drawText(`PROMOTOR: ${promoterName}`, { x: 50, y, size: 12, font: simpleFont });
          y -= 20;
          pageSimple.drawText(`ITENS: ${routeItemsCount}`, { x: 50, y, size: 10, font: simpleFont });
          y -= 30;
          
          for(const item of routes) {
            const text = `${item.weekday} - ${item.storeName} - ${item.industryName}`;
            // Validar string antes do drawText
            if (typeof text !== 'string') {
               throw new Error(`Invalid text type for item: ${JSON.stringify(item)}`);
            }
            pageSimple.drawText(text.substring(0, 80), { x: 50, y, size: 8, font: simpleFont });
            y -= 12;
            if (y < 50) break;
          }
          const simpleBytes = await simpleDoc.save();
          pdfSimpleStatus = simpleBytes.length > 0 ? "OK" : "ERRO (EMPTY)";
          log("Simple PDF Test OK", { byteLength: simpleBytes.length });

          currentStep = "STEP 9 = draw content (FULL)";
          const { renderPromoterRoutePdf } = await import("@/lib/reports/promoter-pdf.server");
          const fullBytes = await renderPromoterRoutePdf({
            routes,
            promoterName,
            referenceDate,
          });
          pdfCompleteStatus = fullBytes.length > 0 ? "OK" : "ERRO (EMPTY)";
          log("Full PDF Render OK", { byteLength: fullBytes.length });

          currentStep = "STEP 10 = pdf save";
          // Se chegamos aqui, o fullBytes é o que queremos
          log("Final Save OK");

          currentStep = "STEP 11 = response";
          const filename = `DIAGNOSTICO_${promoterName.replace(/\s+/g, '_')}.pdf`;
          log("Sending success response");
          const ab = fullBytes.buffer.slice(fullBytes.byteOffset, fullBytes.byteOffset + fullBytes.byteLength) as ArrayBuffer;
          return new Response(ab, {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `attachment; filename="${filename}"`,
              "x-diag-step": currentStep,
              "x-diag-route-count": String(routeItemsCount)
            },
          });

        } catch (error: any) {
          log("FATAL ERROR", { 
            name: error?.name, 
            message: error?.message, 
            stack: error?.stack,
            step: currentStep 
          });
          
          // No ambiente Preview/Dev, retornar JSON detalhado conforme solicitado
          return new Response(JSON.stringify({
            error: "PDF_EXPORT_FAILED",
            step: currentStep,
            name: error?.name || "Error",
            message: error?.message || "Unknown error",
            stack: error?.stack,
            requestDetails: {
              promoterId,
              promoterName,
              referenceDate,
              routeItemsCount
            },
            status: {
              minimal: pdfMinimalStatus,
              simple: pdfSimpleStatus,
              complete: pdfCompleteStatus
            }
          }), {
            status: 200, // Retornamos 200 para o client ler o JSON facilmente
            headers: { "content-type": "application/json" }
          });
        }
      },

    },
  },
});
