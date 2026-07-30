/**
 * Detector técnico 1 — PROJECTION_FREQUENCY_DIVERGENCE (REALTIME).
 *
 * Compara a projeção `mk9_industry_store_frequency` com a vigência atual em
 * `mk9_industry_store_frequency_versions` (fonte única desde a Fase 1).
 * Resultado esperado hoje: ZERO divergências.
 */
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "PROJECTION_FREQUENCY_DIVERGENCE";

export const projectionFrequencyDivergenceDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "FREQUENCIA",
  mode: "REALTIME",
  issueTypes: [ISSUE_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    const { data, error } = await ctx.supabase.rpc("mk9_quality_projection_divergence");
    if (error) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const allowed = ctx.scope.allowedIndustryIds;
    const rows = (data ?? []).filter(
      (r: any) => !allowed || allowed.includes(r.industry_id),
    );
    if (!rows.length) return [];

    return rows.map((r: any) => ({
      category: "FREQUENCIA" as const,
      issueType: ISSUE_TYPE,
      severity: "CRITICO" as const,
      entityType: "INDUSTRY_STORE",
      entityId: r.store_id ?? null,
      industryId: r.industry_id ?? null,
      storeId: r.store_id ?? null,
      competence: { month: ctx.competence.month, year: ctx.competence.year },
      title: "Projeção de frequência divergente da vigência atual",
      description:
        "A projeção de frequência não reflete a versão vigente. Os números do Dashboard, " +
        "Auditoria e Relatório usam a versão vigente — a projeção precisa ser reprojetada.",
      evidence: {
        kind: r.kind,
        projectionWeekly: r.projection_weekly,
        projectionMonthly: r.projection_monthly,
        versionWeekly: r.version_weekly,
        versionMonthly: r.version_monthly,
      },
      suggestedAction: "Reaplicar a projeção a partir da vigência atual da frequência.",
      source: "detector:projection-frequency-divergence",
      fingerprintParts: { kind: r.kind },
      contextParts: {
        projectionWeekly: r.projection_weekly,
        projectionMonthly: r.projection_monthly,
        versionWeekly: r.version_weekly,
        versionMonthly: r.version_monthly,
        versionId: r.version_id,
      },
    }));
  },
};
