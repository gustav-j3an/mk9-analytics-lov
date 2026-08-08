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

    // Performance: O dashboard agora usa um único payload consolidado
    // A função loadOperationCore já foi otimizada para evitar N+1 queries.
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
    let contractedTotal = 0;
    let realizedToDate = 0;
    let lojasSemVisita = 0;
    let extras = 0;

    // 2. UF Aggregation
    const ufMap = new Map<string, any>();
    
    // 3. Frequency Distribution
    const freqMap = new Map<number, number>();

    // Otimização: Um único loop para processar todos os KPIs e distribuições
    for (let i = 0; i < storeRows.length; i++) {
      const s = storeRows[i];
      contractedTotal += s.contratadas;
      realizedToDate += s.realizadas;
      if (s.contratadas > 0 && s.realizadas === 0) lojasSemVisita++;
      extras += Math.max(0, s.realizadas - s.contratadas);

      if (s.contratadas > 0) {
        freqMap.set(s.contratadas, (freqMap.get(s.contratadas) || 0) + 1);
      }

      const uf = s.uf || "N/A";
      let acc = ufMap.get(uf);
      if (!acc) {
        acc = { uf, lojas: 0, contratadas: 0, realizadas: 0, zeradas: 0 };
        ufMap.set(uf, acc);
      }
      acc.lojas += 1;
      acc.contratadas += s.contratadas;
      acc.realizadas += s.realizadas;
      if (s.realizadas === 0 && s.contratadas > 0) acc.zeradas += 1;
    }

    const frequencyDistribution = Array.from(freqMap.entries())
      .map(([freq, count]) => ({ label: `${freq}x/mês`, value: count }))
      .sort((a, b) => parseInt(a.label) - parseInt(b.label));

    const states = Array.from(ufMap.values())
      .map(u => ({ ...u, cobertura: u.contratadas > 0 ? pct(u.realizadas, u.contratadas) : 0 }))
      .sort((a, b) => a.cobertura - b.cobertura);

    // 4. Critical Stores (Top 20)
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
        lojas: i.lojasContratadas,
        contratadas: i.contratadas,
        realizadas: i.realizadas,
        pendentes: i.pendentes,
        cobertura: i.coberturaPct,
        zeradas: i.zeradasCount
      })).sort((a, b) => a.cobertura - b.cobertura),


      dailyExecution: buildDailySeries({
        ctxs,
        industryRows,
        storeRows,
        globalStart: core.globalStart,
        globalEnd: core.globalEnd,
      }),
      perf: {
        coreMs: core.coreMs,
        queryCount: core.queryCount
      }
    };
  });

