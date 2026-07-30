/**
 * Detector MVP 2 — OPERATION_PAIR_INTEGRITY (ROTEIRO / PERSISTED).
 *
 * CONSOLIDA em UMA ocorrência por par (indústria × loja) os três sintomas que
 * antes gerariam três alertas para o mesmo problema:
 *   - loja sem frequência contratada vigente;
 *   - loja sem roteiro ativo;
 *   - visitas realizadas sem roteiro correspondente.
 *
 * Números de frequência vêm SEMPRE da fonte única versionada e do motor
 * `contractedVisitsForFrequencySegments` — nunca `weekly × 4`.
 */
import { contractedVisitsForFrequencySegments } from "@/lib/mk9-frequency/segments";
import { freqKey, loadFrequencyVersionsForPeriod, segmentsForWindow } from "@/lib/mk9-frequency/versions.server";
import { evaluateOperationPair } from "../rules/operation-pair";
import { resolveCompetence } from "../rules/competence";
import { capDetections } from "../rules/cap";
import { navigationTarget } from "../navigation";
import { loadPeriodWindows, loadScopedIndustries, loadScopedStores, unionWindow } from "./context.server";
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "OPERATION_PAIR_INTEGRITY";
const SUMMARY_TYPE = "OPERATION_PAIR_INTEGRITY_SUMMARY";

export const operationPairIntegrityDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "ROTEIRO",
  mode: "PERSISTED",
  issueTypes: [ISSUE_TYPE, SUMMARY_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    const { year, month } = resolveCompetence(ctx.competence);
    const industries = await loadScopedIndustries(ctx.supabase, ctx.scope);
    if (!industries.length) return [];

    const industryIds = industries.map((i) => i.id);
    const industryName = new Map(industries.map((i) => [i.id, i.name]));

    const windows = await loadPeriodWindows(ctx.supabase, industryIds, year, month);
    const union = unionWindow(windows);
    if (!union) return [];

    const stores = await loadScopedStores(ctx.supabase, ctx.scope);
    const storeById = new Map(stores.map((s) => [s.id, s]));
    // Escopo por UF/loja: só entram pares cujas lojas o usuário pode ver.
    const restrictStores = ctx.scope.allowedStoreIds !== null || ctx.scope.allowedUfs !== null;
    const storeAllowed = (id: string) => (restrictStores ? storeById.has(id) : true);

    const frequencies = await loadFrequencyVersionsForPeriod(ctx.supabase, {
      industryIds,
      periodStart: union.startDate,
      periodEnd: union.endDate,
      accessScope: ctx.scope,
    });

    const [routesRes, visitsRes] = await Promise.all([
      ctx.supabase
        .from("mk9_planned_routes")
        .select("industry_id, store_id, valid_from, valid_until")
        .in("industry_id", industryIds)
        .is("archived_at", null)
        .eq("is_active", true)
        .lte("valid_from", union.endDate)
        .or(`valid_until.is.null,valid_until.gte.${union.startDate}`)
        .limit(100000),
      ctx.supabase
        .from("mk9_actual_visits")
        .select("industry_id, store_id, scheduled_date")
        .in("industry_id", industryIds)
        .gte("scheduled_date", union.startDate)
        .lte("scheduled_date", union.endDate)
        .limit(100000),
    ]);
    if (routesRes.error || visitsRes.error) throw new Error("MK9_DQ_DETECTOR_FAILED");

    interface PairFacts { routes: Array<{ from: string; until: string | null }>; visits: string[] }
    const pairs = new Map<string, PairFacts>();
    const ensure = (industryId: string, storeId: string): PairFacts | null => {
      if (!industryId || !storeId || !storeAllowed(storeId)) return null;
      const key = freqKey(industryId, storeId);
      let facts = pairs.get(key);
      if (!facts) {
        facts = { routes: [], visits: [] };
        pairs.set(key, facts);
      }
      return facts;
    };

    for (const key of frequencies.keys()) {
      const [industryId, storeId] = key.split("|");
      ensure(industryId, storeId);
    }
    for (const r of (routesRes.data ?? []) as any[]) {
      ensure(r.industry_id, r.store_id)?.routes.push({
        from: r.valid_from,
        until: r.valid_until ?? null,
      });
    }
    for (const v of (visitsRes.data ?? []) as any[]) {
      ensure(v.industry_id, v.store_id)?.visits.push(v.scheduled_date);
    }

    const issues: DetectedIssue[] = [];
    for (const [key, facts] of pairs) {
      const [industryId, storeId] = key.split("|");
      const win = windows.get(industryId);
      if (!win) continue;

      const segments = segmentsForWindow(frequencies.get(key), win.startDate, win.endDate);
      const contracted = segments.length
        ? contractedVisitsForFrequencySegments({
            segments,
            operationPeriodStart: win.startDate,
            operationPeriodEnd: win.endDate,
          }).contratadas
        : 0;
      const routeCount = facts.routes.filter(
        (r) => r.from <= win.endDate && (r.until ?? "9999-12-31") >= win.startDate,
      ).length;
      const executedVisits = facts.visits.filter(
        (d) => d >= win.startDate && d <= win.endDate,
      ).length;

      const verdict = evaluateOperationPair({
        industryId,
        storeId,
        hasFrequency: segments.length > 0,
        contractedVisits: contracted,
        routeCount,
        executedVisits,
      });
      if (!verdict) continue;

      const store = storeById.get(storeId) ?? null;
      issues.push({
        category: "ROTEIRO" as const,
        issueType: ISSUE_TYPE,
        severity: verdict.severity,
        entityType: "INDUSTRY_STORE",
        entityId: storeId,
        industryId,
        storeId,
        competence: { month, year },
        title: verdict.title,
        description: verdict.description,
        evidence: {
          industryName: industryName.get(industryId) ?? null,
          storeName: store?.name ?? null,
          storeUf: store?.uf ?? null,
          symptoms: verdict.symptoms,
          hasFrequency: segments.length > 0,
          contractedVisits: contracted,
          routeCandidateCount: routeCount,
          executedVisits,
          competence: `${year}-${month}`,
          navigationTarget: navigationTarget({
            module: verdict.symptoms.includes("NO_FREQUENCY") ? "frequency" : "routes",
            industryId,
            storeId,
            month,
            year,
          }),
        },
        suggestedAction: verdict.suggestedAction,
        source: "detector:operation-pair-integrity",
        fingerprintParts: { pair: "industry-store" },
        contextParts: {
          symptoms: verdict.symptoms,
          contractedVisits: contracted,
          routeCount,
          executedVisits,
        },
      });
    }

    // Prioriza os mais graves quando o volume estoura o limite.
    const weight: Record<string, number> = { BLOQUEANTE: 5, CRITICO: 4, ATENCAO: 3, AVISO: 2, INFO: 1 };
    issues.sort((a, b) => (weight[b.severity] ?? 0) - (weight[a.severity] ?? 0));

    return capDetections(issues, (hidden, total) => ({
      category: "ROTEIRO" as const,
      issueType: SUMMARY_TYPE,
      severity: "CRITICO" as const,
      entityType: "SYSTEM",
      competence: { month, year },
      title: "Volume alto de pares indústria × loja incompletos",
      description:
        `${total} pares apresentam inconsistência na competência ${month}/${year}; ` +
        `${hidden} não foram listados individualmente.`,
      evidence: {
        count: total,
        hidden,
        competence: `${year}-${month}`,
        navigationTarget: navigationTarget({ module: "routes", month, year }),
      },
      suggestedAction: "Revisar a base de frequências e roteiros da competência em lote.",
      source: "detector:operation-pair-integrity",
      fingerprintParts: { pair: "industry-store-summary" },
      contextParts: { total },
    }));
  },
};
