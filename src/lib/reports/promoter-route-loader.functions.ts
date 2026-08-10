import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Carrega o roteiro de um promotor para um dia de referência,
 * garantindo paridade total entre a tela de Roteiros e o PDF.
 */
export const loadPromoterRouteForDisplay = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      promoterId: z.string().uuid(),
      referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Busca os itens de roteiro vigentes na data
    const { data: rows, error } = await supabaseAdmin
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
      .eq("promoter_id", data.promoterId)
      .eq("is_active", true)
      .is("archived_at", null)
      .lte("valid_from", data.referenceDate)
      .or(`valid_until.is.null,valid_until.gte.${data.referenceDate}`)
      .order("weekday", { ascending: true });

    if (error) throw new Error(error.message);

    // 2. Mapeia para o formato padrão do sistema
    return (rows ?? []).map((r: any) => ({
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
  });
