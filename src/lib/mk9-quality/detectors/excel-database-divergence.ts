/**
 * Detector MVP 3 — EXCEL_DATABASE_DIVERGENCE (IMPORTACAO / PERSISTED).
 *
 * Compara o que a planilha declarou (contadores da importação) com o que
 * REALMENTE existe no banco hoje. Divergência significa que alguém decide
 * olhando um número que o sistema não reproduz.
 *
 * Categoria técnica: nunca exposta a CLIENTE/PROMOTOR.
 */
import { compareCounters, divergenceSeverity } from "../rules/import-health";
import { resolveCompetence } from "../rules/competence";
import { navigationTarget } from "../navigation";
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "EXCEL_DATABASE_DIVERGENCE";

/** Contadores conhecidos → como medir o valor real no banco. */
const COUNTER_ALIASES: Record<string, string[]> = {
  actualVisits: ["actualVisits", "visits", "visitsCreated", "visitas"],
  frequencies: ["frequencies", "storeFrequencies", "frequencias"],
};

function readCounter(counters: Record<string, unknown>, aliases: string[]): number | null {
  for (const alias of aliases) {
    const raw = counters?.[alias];
    if (raw === null || raw === undefined) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export const excelDatabaseDivergenceDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "IMPORTACAO",
  mode: "PERSISTED",
  issueTypes: [ISSUE_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    if (!ctx.scope.canViewImports) return [];
    const { year, month } = resolveCompetence(ctx.competence);

    let q = ctx.supabase
      .from("mk9_checklist_imports")
      .select("id, industry_id, filename, counters, operation_month, operation_year, finished_at")
      .eq("status", "done")
      .eq("operation_year", year)
      .eq("operation_month", month)
      .order("finished_at", { ascending: false })
      .limit(200);
    if (ctx.scope.allowedIndustryIds) {
      if (!ctx.scope.allowedIndustryIds.length) return [];
      q = q.in("industry_id", ctx.scope.allowedIndustryIds);
    }
    const { data, error } = await q;
    if (error) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const imports = (data ?? []) as any[];
    if (!imports.length) return [];
    const importIds = imports.map((i) => i.id);

    // Medição real, em duas consultas em lote (sem N+1).
    const [visitsRes, freqRes] = await Promise.all([
      ctx.supabase
        .from("mk9_actual_visits")
        .select("source_import_id")
        .in("source_import_id", importIds)
        .limit(200000),
      ctx.supabase
        .from("mk9_industry_store_frequency_versions")
        .select("source_import_id")
        .in("source_import_id", importIds)
        .is("archived_at", null)
        .limit(200000),
    ]);
    if (visitsRes.error || freqRes.error) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const countBy = (rows: any[]) => {
      const map = new Map<string, number>();
      for (const r of rows ?? []) {
        const id = r.source_import_id;
        if (!id) continue;
        map.set(id, (map.get(id) ?? 0) + 1);
      }
      return map;
    };
    const visitsByImport = countBy(visitsRes.data ?? []);
    const freqByImport = countBy(freqRes.data ?? []);

    const issues: DetectedIssue[] = [];
    for (const imp of imports) {
      const counters = (imp.counters ?? {}) as Record<string, unknown>;
      const expected: Record<string, number> = {};
      const actual: Record<string, number> = {};

      const declaredVisits = readCounter(counters, COUNTER_ALIASES.actualVisits);
      if (declaredVisits !== null) {
        expected.actualVisits = declaredVisits;
        actual.actualVisits = visitsByImport.get(imp.id) ?? 0;
      }
      const declaredFreq = readCounter(counters, COUNTER_ALIASES.frequencies);
      if (declaredFreq !== null) {
        expected.frequencies = declaredFreq;
        actual.frequencies = freqByImport.get(imp.id) ?? 0;
      }
      if (!Object.keys(actual).length) continue;

      const divergences = compareCounters(expected, actual);
      if (!divergences.length) continue;

      issues.push({
        category: "IMPORTACAO" as const,
        issueType: ISSUE_TYPE,
        severity: divergenceSeverity(divergences),
        entityType: "IMPORT",
        entityId: imp.id,
        industryId: imp.industry_id ?? null,
        importId: imp.id,
        competence: { month, year },
        title: "Planilha e banco não batem",
        description:
          "Os números declarados pela importação não correspondem ao que existe no banco. " +
          "Relatórios e auditoria podem estar mostrando um total diferente do arquivo original.",
        evidence: {
          divergences: divergences.map((d) => ({
            metric: d.metric,
            expected: d.expected,
            found: d.actual,
            delta: d.delta,
          })),
          competence: `${year}-${month}`,
          navigationTarget: navigationTarget({
            module: "checklists",
            importId: imp.id,
            industryId: imp.industry_id ?? null,
            month,
            year,
          }),
        },
        suggestedAction:
          "Reprocessar a importação ou confirmar qual fonte está correta antes de publicar relatórios.",
        source: "detector:excel-database-divergence",
        fingerprintParts: { divergence: "import-counters" },
        contextParts: {
          divergences: divergences.map((d) => `${d.metric}:${d.expected}->${d.actual}`),
        },
      });
    }

    return issues;
  },
};
