/**
 * Detector — CONTRACT_TOTAL_DISTRIBUTION_DIVERGENCE (FREQUENCIA / PERSISTED).
 *
 * Compara o total comercial contratado informado para a indústria na competência
 * com o total efetivamente distribuído pelas frequências por loja.
 *
 * O total distribuído usa EXCLUSIVAMENTE o motor oficial
 * `contractedVisitsForFrequencySegments` — nenhuma fórmula nova.
 *
 * Nunca corrige automaticamente e nunca bloqueia: exige decisão humana
 * (revisar lojas, alterar o total contratado, aplicar lote ou aceitar com
 * justificativa registrada em audit log).
 */
import {
  computeStoreDistribution,
  divergenceSeverity,
  evaluateContract,
  type StoreDistributionInput,
} from "@/lib/mk9-frequency/bulk";
import { resolveCompetence } from "../rules/competence";
import { navigationTarget } from "../navigation";
import { loadPeriodWindows, loadScopedIndustries, loadScopedStores } from "./context.server";
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "CONTRACT_TOTAL_DISTRIBUTION_DIVERGENCE";

export const contractTotalDistributionDivergenceDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "FREQUENCIA",
  mode: "PERSISTED",
  issueTypes: [ISSUE_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    const { year, month } = resolveCompetence(ctx.competence);

    const industries = await loadScopedIndustries(ctx.supabase, ctx.scope);
    if (!industries.length) return [];
    const industryIds = industries.map((i) => i.id);
    const industryName = new Map(industries.map((i) => [i.id, i.name]));

    const { data: totals, error: totalsErr } = await ctx.supabase
      .from("mk9_industry_contract_totals")
      .select("industry_id, contracted_total, updated_at")
      .in("industry_id", industryIds)
      .eq("competence_year", year)
      .eq("competence_month", month)
      .is("archived_at", null)
      .limit(5000);
    if (totalsErr) throw new Error("MK9_DQ_DETECTOR_FAILED");
    if (!totals?.length) return [];

    const contractByIndustry = new Map<string, number>();
    for (const t of totals as any[]) {
      contractByIndustry.set(t.industry_id, Number(t.contracted_total));
    }

    const windows = await loadPeriodWindows(ctx.supabase, industryIds, year, month);
    const stores = await loadScopedStores(ctx.supabase, ctx.scope);
    const storeById = new Map(stores.map((s) => [s.id, s]));
    const restrictStores = ctx.scope.allowedStoreIds !== null || ctx.scope.allowedUfs !== null;

    const targetIndustries = Array.from(contractByIndustry.keys());

    const { data: versions, error: versErr } = await ctx.supabase
      .from("mk9_industry_store_frequency_versions")
      .select("industry_id, store_id, weekly_frequency, monthly_frequency, valid_from, valid_until")
      .in("industry_id", targetIndustries)
      .is("archived_at", null)
      .limit(100000);
    if (versErr) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const { data: routes, error: routesErr } = await ctx.supabase
      .from("mk9_planned_routes")
      .select("industry_id, store_id")
      .in("industry_id", targetIndustries)
      .eq("is_active", true)
      .is("archived_at", null)
      .limit(100000);
    if (routesErr) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const linked = new Map<string, Set<string>>();
    const addLinked = (industryId: string, storeId: string) => {
      if (restrictStores && !storeById.has(storeId)) return;
      const set = linked.get(industryId) ?? new Set<string>();
      set.add(storeId);
      linked.set(industryId, set);
    };
    for (const r of (versions ?? []) as any[]) addLinked(r.industry_id, r.store_id);
    for (const r of (routes ?? []) as any[]) addLinked(r.industry_id, r.store_id);

    const issues: DetectedIssue[] = [];

    for (const industryId of targetIndustries) {
      const win = windows.get(industryId);
      if (!win) continue;
      const contractedTotal = contractByIndustry.get(industryId)!;
      const storeIds = Array.from(linked.get(industryId) ?? []);
      if (!storeIds.length) continue;

      const byStore = new Map<string, StoreDistributionInput>();
      for (const id of storeIds) {
        const store = storeById.get(id);
        byStore.set(id, {
          storeId: id,
          storeName: store?.name ?? null,
          chain: store?.chain ?? null,
          uf: store?.uf ?? null,
          segments: [],
        });
      }
      for (const v of (versions ?? []) as any[]) {
        if (v.industry_id !== industryId) continue;
        const entry = byStore.get(v.store_id);
        if (!entry) continue;
        if (v.valid_from > win.endDate) continue;
        if ((v.valid_until ?? "9999-12-31") < win.startDate) continue;
        entry.segments.push({
          validFrom: v.valid_from,
          validUntil: v.valid_until ?? null,
          weeklyFrequency: v.weekly_frequency === null ? null : Number(v.weekly_frequency),
          monthlyFrequency: v.monthly_frequency === null ? null : Number(v.monthly_frequency),
        });
      }

      const rows = computeStoreDistribution(Array.from(byStore.values()), {
        start: win.startDate,
        end: win.endDate,
      });
      const check = evaluateContract({ contractedTotal, rows });
      if (check.status === "CONFERIDO" || check.status === "SEM_TOTAL_INFORMADO") continue;

      const severity = divergenceSeverity(check);
      const diff = check.difference ?? 0;

      issues.push({
        category: "FREQUENCIA",
        issueType: ISSUE_TYPE,
        severity,
        entityType: "INDUSTRY",
        entityId: industryId,
        industryId,
        storeId: null,
        competence: { month, year },
        title: "Contrato e distribuição de frequências divergentes",
        description:
          `O total contratado informado é ${contractedTotal} visita(s) e a soma das frequências por ` +
          `loja resulta em ${check.distributedTotal}. Diferença de ${Math.abs(diff)} ` +
          `(${check.differencePercentage}%). Revise as lojas, ajuste o total contratado ou aceite ` +
          "a diferença com justificativa.",
        evidence: {
          industryId,
          industryName: industryName.get(industryId) ?? null,
          contractedTotal,
          distributedTotal: check.distributedTotal,
          difference: diff,
          differencePercentage: check.differencePercentage,
          storesWithFrequency: check.storesWithFrequency,
          storesWithoutFrequency: check.storesWithoutFrequency,
          competence: { month, year },
          periodStart: win.startDate,
          periodEnd: win.endDate,
          status: check.status,
          navigationTarget: navigationTarget({ module: "frequency", industryId, month, year }),
        },
        suggestedAction:
          "Conferir a distribuição de frequências por loja da indústria na competência. " +
          "A diferença nunca é corrigida automaticamente.",
        source: "detector:contract-total-distribution-divergence",
        fingerprintParts: { industryId, month, year },
        contextParts: {
          contractedTotal,
          distributedTotal: check.distributedTotal,
          difference: diff,
        },
      });
    }

    return issues;
  },
};
