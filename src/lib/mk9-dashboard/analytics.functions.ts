import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const analyticsFiltersSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  industryId: z.string().uuid().nullish(),
  uf: z.string().max(2).nullish(),
});

export const getAnalyticsDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => analyticsFiltersSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireMk9ReadScope } = await import("@/lib/mk9-auth/read-guards.server");
    const { scope } = await requireMk9ReadScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOperationCore } = await import("@/lib/mk9-operations/core.server");
    const { buildDailySeries } = await import("@/lib/mk9-operations/buckets");
    const { pct } = await import("@/lib/mk9-operations/periods");

    const core = await loadOperationCore(supabaseAdmin, {
      ...data,
      access: {
        allowedIndustryIds: scope.allowedIndustryIds,
        allowedUfs: scope.allowedUfs,
        allowedStoreIds: scope.allowedStoreIds,
        allowedPromoterIds: scope.allowedPromoterIds,
        canViewPersonalData: scope.canViewPersonalData,
      }
    });

    if (core.empty) return null;

    const { storeRows, industryRows, ctxs } = core;

    // 1. Summary KPIs
    const contractedTotal = storeRows.reduce((a, s) => a + s.contratadas, 0);
    const realizedToDate = storeRows.reduce((a, s) => a + s.realizadas, 0);
    const lojasSemVisita = storeRows.filter((s) => s.contratadas > 0 && s.realizadas === 0).length;
    const extras = storeRows.reduce((a, s) => a + Math.max(0, s.realizadas - s.contratadas), 0);

    // 2. Frequency Distribution
    const freqMap = new Map<number, number>();
    storeRows.forEach(s => {
      if (s.contratadas > 0) {
        freqMap.set(s.contratadas, (freqMap.get(s.contratadas) || 0) + 1);
      }
    });
    const frequencyDistribution = Array.from(freqMap.entries())
      .map(([freq, count]) => ({ label: `${freq}x/mês`, value: count }))
      .sort((a, b) => parseInt(a.label) - parseInt(b.label));

    // 3. Execution by UF
    const ufMap = new Map<string, any>();
    storeRows.forEach(s => {
      const uf = s.uf || "N/A";
      const acc = ufMap.get(uf) || { uf, lojas: 0, contratadas: 0, realizadas: 0, zeradas: 0 };
      acc.lojas += 1;
      acc.contratadas += s.contratadas;
      acc.realizadas += s.realizadas;
      if (s.realizadas === 0 && s.contratadas > 0) acc.zeradas += 1;
      ufMap.set(uf, acc);
    });
    const states = Array.from(ufMap.values())
      .map(u => ({ ...u, cobertura: u.contratadas > 0 ? pct(u.realizadas, u.contratadas) : 0 }))
      .sort((a, b) => a.cobertura - b.cobertura);

    // 4. Critical Stores
    const criticalStores = storeRows
      .filter(s => s.contratadas > 0)
      .map(s => ({
        ...s,
        cobertura: pct(s.realizadas, s.contratadas),
        pendentes: Math.max(0, s.contratadas - s.realizadas)
      }))
      .sort((a, b) => {
        if (a.realizadas === 0 && b.realizadas > 0) return -1;
        if (b.realizadas === 0 && a.realizadas > 0) return 1;
        return b.pendentes - a.pendentes || a.cobertura - b.cobertura;
      })
      .slice(0, 20);

    return {
      summary: {
        contratadas: contractedTotal,
        realizadas: realizedToDate,
        pendentes: Math.max(0, contractedTotal - realizedToDate),
        extras,
        cobertura: contractedTotal > 0 ? pct(realizedToDate, contractedTotal) : 0,
        lojasSemAtendimento: lojasSemVisita
      },
      frequencyDistribution,
      states,
      criticalStores,
      industries: industryRows.map(i => ({
        id: i.industryId,
        name: i.industryName,
        lojas: storeRows.filter(s => s.industryId === i.industryId).length,
        contratadas: i.contratadas,
        realizadas: i.realizadas,
        pendentes: i.pendentes,
        cobertura: i.coberturaPct,
        zeradas: storeRows.filter(s => s.industryId === i.industryId && s.realizadas === 0 && s.contratadas > 0).length
      })).sort((a, b) => a.cobertura - b.cobertura),
      dailyExecution: buildDailySeries({
        ctxs,
        industryRows,
        storeRows,
        globalStart: core.globalStart,
        globalEnd: core.globalEnd,
      })
    };
  });
