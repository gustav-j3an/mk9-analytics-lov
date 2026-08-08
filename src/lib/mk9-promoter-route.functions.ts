import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadOperationCore } from "@/lib/mk9-operations/core.server";
import { requireMk9ReadScope } from "@/lib/mk9-auth/read-guards.server";

export const mk9PromoterRouteStats = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        promoterId: z.string().uuid(),
        year: z.number().int(),
        month: z.number().int(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reutiliza o motor operacional core para garantir paridade total de números
    const core = await loadOperationCore(supabaseAdmin, {
      year: data.year,
      month: data.month,
      promoterId: data.promoterId,
      access: scope,
    });

    if (core.empty || core.storeRows.length === 0) {
      return {
        totalVisits: 0,
        uniqueStores: 0,
        uniqueIndustries: 0,
        byWeekday: [0, 0, 0, 0, 0, 0, 0],
      };
    }

    const uniqueStores = new Set<string>();
    const uniqueIndustries = new Set<string>();
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    let totalVisits = 0;

    // Filtra as linhas do core pelo promotor (loadOperationCore já filtrou, mas garantimos)
    const rows = core.storeRows.filter((r) => r.promoterId === data.promoterId);

    for (const row of rows) {
      uniqueStores.add(row.storeId);
      uniqueIndustries.add(row.industryId);
      totalVisits += row.contratadas;

      // Distribuição por dia da semana vinda do roteiro planejado
      const routeInfo = core.routeByKey.get(`${row.industryId}|${row.storeId}`);
      if (routeInfo) {
        // Se a loja tem contratadas > 0, distribuímos essas visitas entre os dias do roteiro.
        // Como o roteiro planejado (mk9_planned_routes) é semanal, o total de contratadas
        // no mês é distribuído proporcionalmente.
        // Simplificação segura: se contratadas=4 e tem 1 dia na semana, aquele dia tem as 4.
        const daysCount = routeInfo.weekdays.size;
        if (daysCount > 0) {
          const perDay = row.contratadas / daysCount;
          for (const wd of routeInfo.weekdays) {
            byWeekday[wd] += perDay;
          }
        }
      }
    }

    return {
      totalVisits: Math.round(totalVisits),
      uniqueStores: uniqueStores.size,
      uniqueIndustries: uniqueIndustries.size,
      byWeekday: byWeekday.map((v) => Math.round(v)),
    };
  });
