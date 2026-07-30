/**
 * Detector MVP 6 — CHECKLIST_IMPORT_WITHOUT_VALIDATION (IMPORTACAO / PERSISTED).
 *
 * Checklist importado e concluído, mas sem validação humana registrada. Os
 * números já estão valendo em relatórios sem que ninguém tenha conferido.
 */
import { needsChecklistValidation } from "../rules/import-health";
import { resolveCompetence } from "../rules/competence";
import { navigationTarget } from "../navigation";
import { capDetections } from "../rules/cap";
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "CHECKLIST_IMPORT_WITHOUT_VALIDATION";
const SUMMARY_TYPE = "CHECKLIST_IMPORT_WITHOUT_VALIDATION_SUMMARY";

export const checklistValidationDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "IMPORTACAO",
  mode: "PERSISTED",
  issueTypes: [ISSUE_TYPE, SUMMARY_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    if (!ctx.scope.canViewImports) return [];
    const { year, month } = resolveCompetence(ctx.competence);

    let q = ctx.supabase
      .from("mk9_checklist_imports")
      .select(
        "id, industry_id, filename, status, validation_status, validated_at, finished_at, operation_month, operation_year",
      )
      .eq("status", "done")
      .eq("operation_year", year)
      .eq("operation_month", month)
      .order("finished_at", { ascending: false })
      .limit(500);
    if (ctx.scope.allowedIndustryIds) {
      if (!ctx.scope.allowedIndustryIds.length) return [];
      q = q.in("industry_id", ctx.scope.allowedIndustryIds);
    }
    const { data, error } = await q;
    if (error) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const issues: DetectedIssue[] = [];
    for (const row of (data ?? []) as any[]) {
      const pending = needsChecklistValidation({
        status: row.status,
        validationStatus: row.validation_status ?? null,
        validatedAt: row.validated_at ?? null,
        finishedAt: row.finished_at ?? null,
      });
      if (!pending) continue;

      issues.push({
        category: "IMPORTACAO" as const,
        issueType: ISSUE_TYPE,
        severity: "ATENCAO" as const,
        entityType: "IMPORT_CHECKLIST",
        entityId: row.id,
        industryId: row.industry_id ?? null,
        importId: row.id,
        competence: { month, year },
        title: "Checklist importado sem validação",
        description:
          "O checklist foi processado e já influencia os números da competência, mas ninguém " +
          "registrou a validação do resultado.",
        evidence: {
          filename: String(row.filename ?? ""),
          validationStatus: row.validation_status ?? null,
          competence: `${year}-${month}`,
          navigationTarget: navigationTarget({
            module: "checklists",
            importId: row.id,
            industryId: row.industry_id ?? null,
            month,
            year,
          }),
        },
        suggestedAction: "Conferir o resumo da importação e registrar a validação da competência.",
        source: "detector:checklist-validation",
        fingerprintParts: { validation: "checklist-import" },
        contextParts: { validationStatus: row.validation_status ?? null },
      });
    }

    return capDetections(issues, (hidden, total) => ({
      category: "IMPORTACAO" as const,
      issueType: SUMMARY_TYPE,
      severity: "ATENCAO" as const,
      entityType: "SYSTEM",
      competence: { month, year },
      title: "Muitos checklists sem validação",
      description: `${total} checklists da competência ${month}/${year} seguem sem validação; ${hidden} não foram listados.`,
      evidence: {
        count: total,
        hidden,
        competence: `${year}-${month}`,
        navigationTarget: navigationTarget({ module: "checklists", month, year }),
      },
      suggestedAction: "Validar as importações de checklist pendentes da competência.",
      source: "detector:checklist-validation",
      fingerprintParts: { validation: "checklist-summary" },
      contextParts: { total },
    }));
  },
};
