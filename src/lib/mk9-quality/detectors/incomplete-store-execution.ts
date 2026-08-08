/**
 * Detector MVP 7 — INCOMPLETE_STORE_WITH_EXECUTION (CADASTRO / PERSISTED).
 *
 * Loja com cadastro incompleto (criada automaticamente na importação, sem UF
 * ou sem rede) que JÁ está recebendo operação. É o caminho mais comum para
 * duplicidade futura e para relatório com UF errada.
 *
 * Loja incompleta e sem operação não vira ocorrência: é ruído de cadastro.
 */
import { resolveCompetence, calendarWindow } from "../rules/competence";
import { navigationTarget } from "../navigation";
import { capDetections } from "../rules/cap";
import { loadScopedStores } from "./context.server";
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "INCOMPLETE_STORE_WITH_EXECUTION";
const SUMMARY_TYPE = "INCOMPLETE_STORE_WITH_EXECUTION_SUMMARY";

export const incompleteStoreExecutionDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "CADASTRO",
  mode: "PERSISTED",
  issueTypes: [ISSUE_TYPE, SUMMARY_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    const { year, month } = resolveCompetence(ctx.competence);
    const window = calendarWindow(year, month);

    const stores = await loadScopedStores(ctx.supabase, ctx.scope);
    const suspicious = stores.filter((s) => s.isIncomplete || !s.uf || !s.chain);
    if (!suspicious.length) return [];
    const storeIds = suspicious.map((s) => s.id);

    const [visitRes, freqRes, routeRes] = await Promise.all([
      ctx.supabase
        .from("mk9_actual_visits")
        .select("store_id, industry_id")
        .in("store_id", storeIds)
        .gte("scheduled_date", window.startDate)
        .lte("scheduled_date", window.endDate)
        .limit(100000),
      ctx.supabase
        .from("mk9_industry_store_frequency_versions")
        .select("store_id, industry_id")
        .in("store_id", storeIds)
        .is("archived_at", null)
        .lte("valid_from", window.endDate)
        .or(`valid_until.is.null,valid_until.gte.${window.startDate}`)
        .limit(100000),
      ctx.supabase
        .from("mk9_planned_routes")
        .select("store_id, industry_id")
        .in("store_id", storeIds)
        .is("archived_at", null)
        .eq("is_active", true)
        .lte("valid_from", window.endDate)
        .or(`valid_until.is.null,valid_until.gte.${window.startDate}`)
        .limit(100000),
    ]);
    if (visitRes.error || freqRes.error || routeRes.error)
      throw new Error("MK9_DQ_DETECTOR_FAILED");

    interface Usage {
      visits: number;
      frequencies: number;
      routes: number;
      industryId: string | null;
    }
    const usage = new Map<string, Usage>();
    const bump = (
      storeId: string,
      industryId: string | null,
      field: keyof Omit<Usage, "industryId">,
    ) => {
      const current = usage.get(storeId) ?? { visits: 0, frequencies: 0, routes: 0, industryId };
      current[field] += 1;
      current.industryId = current.industryId ?? industryId;
      usage.set(storeId, current);
    };
    for (const r of (visitRes.data ?? []) as any[])
      bump(r.store_id, r.industry_id ?? null, "visits");
    for (const r of (freqRes.data ?? []) as any[])
      bump(r.store_id, r.industry_id ?? null, "frequencies");
    for (const r of (routeRes.data ?? []) as any[])
      bump(r.store_id, r.industry_id ?? null, "routes");

    const issues: DetectedIssue[] = [];
    for (const store of suspicious) {
      const used = usage.get(store.id);
      if (!used) continue;

      const missing: string[] = [];
      if (!store.uf) missing.push("UF");
      if (!store.chain) missing.push("REDE");
      if (store.isIncomplete && !missing.length) missing.push("CADASTRO_INCOMPLETO");
      if (!missing.length) continue;

      issues.push({
        category: "CADASTRO" as const,
        issueType: ISSUE_TYPE,
        // Sem UF a loja some dos recortes regionais: impacto direto no número.
        severity: !store.uf ? "CRITICO" : "ATENCAO",
        entityType: "STORE",
        entityId: store.id,
        storeId: store.id,
        industryId: used.industryId,
        competence: { month, year },
        title: "Loja com cadastro incompleto já em operação",
        description:
          `A loja "${store.name}" está recebendo operação na competência ${month}/${year} com ` +
          `cadastro incompleto (falta: ${missing.join(", ")}). Isso distorce recortes por ` +
          "região/rede e favorece cadastro duplicado.",
        evidence: {
          storeName: store.name,
          storeUf: store.uf,
          chain: store.chain,
          missing,
          executedVisits: used.visits,
          frequencyVersions: used.frequencies,
          routeCandidateCount: used.routes,
          competence: `${year}-${month}`,
          navigationTarget: navigationTarget({ module: "stores", storeId: store.id, month, year }),
        },
        suggestedAction:
          "Completar o cadastro da loja (UF e rede) e confirmar que não é duplicata.",
        source: "detector:incomplete-store-execution",
        fingerprintParts: { store: "incomplete" },
        contextParts: {
          missing,
          visits: used.visits,
          routes: used.routes,
          frequencies: used.frequencies,
        },
      });
    }

    return capDetections(issues, (hidden, total) => ({
      category: "CADASTRO" as const,
      issueType: SUMMARY_TYPE,
      severity: "CRITICO" as const,
      entityType: "SYSTEM",
      competence: { month, year },
      title: "Muitas lojas incompletas em operação",
      description: `${total} lojas incompletas operam na competência ${month}/${year}; ${hidden} não foram listadas.`,
      evidence: {
        count: total,
        hidden,
        competence: `${year}-${month}`,
        navigationTarget: navigationTarget({ module: "stores", month, year }),
      },
      suggestedAction: "Executar uma revisão em lote do cadastro de lojas criadas por importação.",
      source: "detector:incomplete-store-execution",
      fingerprintParts: { store: "incomplete-summary" },
      contextParts: { total },
    }));
  },
};
