import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCurrentPromoter } from "@/lib/mk9-auth/promoter-resolver.server";

export const getMyPromoterRoute = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => 
    z.object({
      month: z.number(),
      year: z.number()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const promoter = await getCurrentPromoter();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reutilizamos a lógica de busca de roteiro, mas garantimos que o promoter_id
    // venha da nossa resolução segura server-side, nunca do payload do cliente.
    const { data: routes, error } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select(`
        *,
        store:mk9_stores(id, name, chain, uf, latitude, longitude),
        industry:mk9_industries(id, name, requires_checklist),
        evidence:mk9_visit_evidence(id, status, photo_path, location_status, distance_from_store_meters, accuracy_meters, rejection_reason, captured_at)
      `)
      .eq("promoter_id", promoter.id)
      .eq("operation_month", data.month)
      .eq("operation_year", data.year)
      .eq("is_active", true)
      .is("archived_at", null);

    if (error) {
      console.error("[MK9-PORTAL] Erro ao buscar roteiro:", error);
      throw new Error("Falha ao carregar roteiro programado.");
    }

    // Normaliza o retorno para o padrão esperado pelo frontend do portal
    return (routes || []).map(r => {
      // Filtrar evidências que batem com o dia da semana planejado
      // Nota: No portal, r.evidence é uma lista (mesmo que geralmente tenha 1).
      // Queremos a evidência mais recente capturada que bate com o dia da semana da rota se possível,
      // ou a última evidência se não houver data discriminada.
      const evidences = (r.evidence as any[]) || [];
      const bestEvidence = evidences.find(e => {
        if (!e.captured_at) return true;
        const eDate = new Date(e.captured_at);
        return eDate.getDay() === r.weekday;
      }) || evidences[evidences.length - 1];

      return {
        id: r.id,
        storeId: r.store_id,
        storeName: (r.store as any)?.name,
        storeChain: (r.store as any)?.chain,
        storeUf: (r.store as any)?.uf,
        industryId: r.industry_id,
        industryName: (r.industry as any)?.name,
        requiresChecklist: (r.industry as any)?.requires_checklist,
        weekday: r.weekday,
        operationMonth: r.operation_month,
        operationYear: r.operation_year,
        evidenceStatus: bestEvidence?.status || null,
        evidenceId: bestEvidence?.id || null,
        locationStatus: bestEvidence?.location_status || null,
        rejectionReason: bestEvidence?.rejection_reason || null,
        distanceFromStore: bestEvidence?.distance_from_store_meters || null,
        accuracy: bestEvidence?.accuracy_meters || null,
        storeLat: (r.store as any)?.latitude || null,
        storeLon: (r.store as any)?.longitude || null
      };
    });
  });

export const getMyPromoterProfile = createServerFn({ method: "GET" })
  .handler(async () => {
    return await getCurrentPromoter();
  });
