/**
 * Detector MVP — FREQUENCY_WEEKLY_MONTHLY_INCONSISTENCY (FREQUENCIA / PERSISTED).
 *
 * Sinaliza vigências de frequência cuja combinação semanal × mensal não segue a
 * regra comercial canônica documentada em `@/lib/mk9-frequency/canonical`:
 *
 *   0,5/2 · 1/4 · 1,5/6 · 2/8 · 3/12
 *
 * IMPORTANTE: `weekly × 4` continua PROIBIDA como cálculo de contratadas — as
 * contratadas seguem vindo de `contractedVisitsForFrequencySegments`. Aqui a
 * relação é usada exclusivamente como validação de coerência entre os dois
 * campos cadastrados, com tolerância numérica explícita.
 *
 * Nunca corrige automaticamente: exige revisão humana.
 */
import {
  evaluateFrequencyConsistency,
  FREQUENCY_TOLERANCE,
} from "@/lib/mk9-frequency/canonical";
import { resolveCompetence } from "../rules/competence";
import { capDetections } from "../rules/cap";
import { navigationTarget } from "../navigation";
import { loadPeriodWindows, loadScopedIndustries, loadScopedStores, unionWindow } from "./context.server";
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "FREQUENCY_WEEKLY_MONTHLY_INCONSISTENCY";
const SUMMARY_TYPE = "FREQUENCY_WEEKLY_MONTHLY_INCONSISTENCY_SUMMARY";

export const frequencyWeeklyMonthlyInconsistencyDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "FREQUENCIA",
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
    const restrictStores = ctx.scope.allowedStoreIds !== null || ctx.scope.allowedUfs !== null;

    // Consulta enxuta e em lote — sem SELECT *, sem PII, com limite explícito.
    const { data, error } = await ctx.supabase
      .from("mk9_industry_store_frequency_versions")
      .select(
        "id, industry_id, store_id, weekly_frequency, monthly_frequency, valid_from, valid_until, source_type, source_import_id",
      )
      .in("industry_id", industryIds)
      .is("archived_at", null)
      .lte("valid_from", union.endDate)
      .or(`valid_until.is.null,valid_until.gte.${union.startDate}`)
      .limit(100000);
    if (error) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const issues: DetectedIssue[] = [];

    for (const row of (data ?? []) as any[]) {
      const industryId = row.industry_id as string | null;
      const storeId = row.store_id as string | null;
      if (!industryId || !storeId) continue;
      if (restrictStores && !storeById.has(storeId)) continue;

      const state = evaluateFrequencyConsistency(row.weekly_frequency, row.monthly_frequency);
      if (!state.evaluable || state.consistent) continue;

      const store = storeById.get(storeId);
      const difference = Math.round((state.difference ?? 0) * 10000) / 10000;

      issues.push({
        category: "FREQUENCIA",
        issueType: ISSUE_TYPE,
        severity: "ATENCAO",
        entityType: "INDUSTRY_STORE_FREQUENCY_VERSION",
        entityId: row.id ?? null,
        industryId,
        storeId,
        competence: { month, year },
        title: "Frequência semanal e mensal divergentes",
        description:
          `A loja está cadastrada com ${state.weekly}x/semana e ${state.monthly}x/mês. ` +
          `Pela regra comercial, ${state.weekly}x/semana corresponde a ${state.expectedMonthly}x/mês. ` +
          "Os números contratados continuam sendo calculados pela vigência — mas a combinação " +
          "cadastrada precisa de revisão.",
        evidence: {
          industryId,
          industryName: industryName.get(industryId) ?? null,
          storeId,
          storeName: store?.name ?? null,
          storeUf: store?.uf ?? null,
          chain: store?.chain ?? null,
          weeklyFrequency: state.weekly,
          monthlyFrequency: state.monthly,
          expectedMonthly: state.expectedMonthly,
          difference,
          tolerance: FREQUENCY_TOLERANCE,
          versionId: row.id ?? null,
          validFrom: row.valid_from ?? null,
          validUntil: row.valid_until ?? null,
          sourceType: row.source_type ?? null,
          sourceImportId: row.source_import_id ?? null,
          navigationTarget: navigationTarget("frequency", {
            industryId,
            storeId,
            month,
            year,
          }),
        },
        suggestedAction:
          "Revisar a frequência semanal e mensal da loja. A combinação cadastrada não segue a " +
          "regra comercial esperada.",
        source: "detector:frequency-weekly-monthly-inconsistency",
        fingerprintParts: { industryId, storeId, validFrom: row.valid_from ?? null },
        contextParts: {
          weekly: state.weekly,
          monthly: state.monthly,
          expectedMonthly: state.expectedMonthly,
          validUntil: row.valid_until ?? null,
        },
      });
    }

    if (!issues.length) return [];

    return capDetections(issues, (hidden, total) => ({
      category: "FREQUENCIA",
      issueType: SUMMARY_TYPE,
      severity: "ATENCAO",
      entityType: "SYSTEM",
      competence: { month, year },
      title: "Muitas frequências com semanal e mensal divergentes",
      description:
        `${total} vigências têm combinação semanal × mensal fora da regra comercial. ` +
        `${hidden} não estão listadas individualmente.`,
      evidence: { count: total, hidden },
      suggestedAction:
        "Revisar o cadastro de frequência das lojas afetadas antes do próximo fechamento.",
      source: "detector:frequency-weekly-monthly-inconsistency",
      fingerprintParts: { summary: "frequency-weekly-monthly", month, year },
      contextParts: { count: total },
    }));
  },
};
