/**
 * Detector MVP 5 — INDUSTRY_WITHOUT_PERIOD_CONFIG (CADASTRO / PERSISTED).
 *
 * Indústria com operação no período mas sem configuração de período ativa.
 * Sem ela, o sistema assume mês-calendário — e o número contratado pode não
 * ser o que o contrato diz (ciclos 26→25, por exemplo).
 */
import { resolveCompetence, calendarWindow } from "../rules/competence";
import { navigationTarget } from "../navigation";
import { loadScopedIndustries } from "./context.server";
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "INDUSTRY_WITHOUT_PERIOD_CONFIG";

export const industryPeriodConfigDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "CADASTRO",
  mode: "PERSISTED",
  issueTypes: [ISSUE_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    const { year, month } = resolveCompetence(ctx.competence);
    const industries = await loadScopedIndustries(ctx.supabase, ctx.scope);
    if (!industries.length) return [];
    const industryIds = industries.map((i) => i.id);
    const window = calendarWindow(year, month);

    const [configRes, freqRes, visitRes] = await Promise.all([
      ctx.supabase
        .from("mk9_industry_period_config")
        .select("industry_id, period_type, start_day, end_day, active")
        .in("industry_id", industryIds)
        .limit(2000),
      ctx.supabase
        .from("mk9_industry_store_frequency_versions")
        .select("industry_id")
        .in("industry_id", industryIds)
        .is("archived_at", null)
        .lte("valid_from", window.endDate)
        .or(`valid_until.is.null,valid_until.gte.${window.startDate}`)
        .limit(100000),
      ctx.supabase
        .from("mk9_actual_visits")
        .select("industry_id")
        .in("industry_id", industryIds)
        .gte("scheduled_date", window.startDate)
        .lte("scheduled_date", window.endDate)
        .limit(100000),
    ]);
    if (configRes.error || freqRes.error || visitRes.error)
      throw new Error("MK9_DQ_DETECTOR_FAILED");

    const configs = new Map<string, any>();
    for (const row of (configRes.data ?? []) as any[]) configs.set(row.industry_id, row);

    const operating = new Set<string>();
    for (const r of (freqRes.data ?? []) as any[]) operating.add(r.industry_id);
    for (const r of (visitRes.data ?? []) as any[]) operating.add(r.industry_id);

    const issues: DetectedIssue[] = [];
    for (const industry of industries) {
      if (!operating.has(industry.id)) continue;
      const config = configs.get(industry.id) ?? null;

      let reason: string | null = null;
      if (!config) reason = "MISSING";
      else if (config.active === false) reason = "INACTIVE";
      else if (
        config.period_type === "CUSTOM_CYCLE" &&
        (!Number.isFinite(Number(config.start_day)) ||
          !Number.isFinite(Number(config.end_day)) ||
          Number(config.start_day) < 1 ||
          Number(config.start_day) > 31 ||
          Number(config.end_day) < 1 ||
          Number(config.end_day) > 31)
      ) {
        reason = "INVALID_CYCLE";
      }
      if (!reason) continue;

      issues.push({
        category: "CADASTRO" as const,
        issueType: ISSUE_TYPE,
        severity: reason === "INVALID_CYCLE" ? "CRITICO" : "ATENCAO",
        entityType: "INDUSTRY",
        entityId: industry.id,
        industryId: industry.id,
        competence: { month, year },
        title: "Indústria operando sem período configurado",
        description:
          `A indústria ${industry.name} tem operação na competência ${month}/${year}, mas ` +
          "não possui configuração de período válida. O cálculo assume mês-calendário, " +
          "o que pode divergir do ciclo contratado.",
        evidence: {
          industryName: industry.name,
          reason,
          periodType: config?.period_type ?? null,
          competence: `${year}-${month}`,
          navigationTarget: navigationTarget({
            module: "industries",
            industryId: industry.id,
            month,
            year,
          }),
        },
        suggestedAction:
          "Cadastrar (ou reativar) o período operacional da indústria antes de fechar a competência.",
        source: "detector:industry-period-config",
        fingerprintParts: { config: "period" },
        contextParts: { reason, periodType: config?.period_type ?? null },
      });
    }

    return issues;
  },
};
