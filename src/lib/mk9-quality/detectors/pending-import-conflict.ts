/**
 * Detector MVP 4 — PENDING_IMPORT_CONFLICT (IMPORTACAO / PERSISTED).
 *
 * Importações que falharam ou ficaram travadas em andamento. Enquanto existirem,
 * a base pode estar parcialmente atualizada — e ninguém percebe.
 *
 * Cobre as duas filas: base MK9 (`mk9_imports`) e checklists
 * (`mk9_checklist_imports`). Categoria técnica: fora do alcance de CLIENTE.
 */
import { evaluateImportHealth, STUCK_MINUTES } from "../rules/import-health";
import { navigationTarget } from "../navigation";
import { capDetections } from "../rules/cap";
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "PENDING_IMPORT_CONFLICT";
const SUMMARY_TYPE = "PENDING_IMPORT_CONFLICT_SUMMARY";

const SYMPTOM_TEXT: Record<string, string> = {
  FAILED: "A importação falhou e não concluiu a atualização da base.",
  STUCK_IN_PROGRESS: `A importação está em andamento há mais de ${STUCK_MINUTES} minutos.`,
  NEVER_FINISHED: "A importação consta como concluída, mas não registrou o término.",
};

export const pendingImportConflictDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "IMPORTACAO",
  mode: "PERSISTED",
  issueTypes: [ISSUE_TYPE, SUMMARY_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    if (!ctx.scope.canViewImports) return [];
    const now = new Date();
    const open = ["pending", "previewing", "confirmed", "committing", "failed", "done"];

    let checklistQuery = ctx.supabase
      .from("mk9_checklist_imports")
      .select("id, industry_id, filename, status, started_at, finished_at, operation_month, operation_year")
      .in("status", open)
      .order("started_at", { ascending: false })
      .limit(500);
    if (ctx.scope.allowedIndustryIds) {
      if (!ctx.scope.allowedIndustryIds.length) return [];
      checklistQuery = checklistQuery.in("industry_id", ctx.scope.allowedIndustryIds);
    }

    // A base MK9 é global (não pertence a uma indústria): só papéis com visão
    // ampla a enxergam, para não vazar operação de terceiros por dedução.
    const baseQuery = ctx.scope.canViewAll
      ? ctx.supabase
          .from("mk9_imports")
          .select("id, filename, status, started_at, finished_at, operation_month, operation_year")
          .in("status", open)
          .order("started_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null });

    const [checklistRes, baseRes] = await Promise.all([checklistQuery, baseQuery]);
    if (checklistRes.error || (baseRes as any).error) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const rows: Array<{ row: any; kind: "CHECKLIST" | "BASE" }> = [
      ...((checklistRes.data ?? []) as any[]).map((row) => ({ row, kind: "CHECKLIST" as const })),
      ...(((baseRes as any).data ?? []) as any[]).map((row) => ({ row, kind: "BASE" as const })),
    ];

    const issues: DetectedIssue[] = [];
    for (const { row, kind } of rows) {
      const verdict = evaluateImportHealth(
        { status: row.status, startedAt: row.started_at ?? null, finishedAt: row.finished_at ?? null },
        now,
      );
      if (!verdict) continue;

      issues.push({
        category: "IMPORTACAO" as const,
        issueType: ISSUE_TYPE,
        severity: verdict.severity,
        entityType: kind === "BASE" ? "IMPORT_BASE" : "IMPORT_CHECKLIST",
        entityId: row.id,
        industryId: row.industry_id ?? null,
        importId: row.id,
        competence:
          row.operation_year || row.operation_month
            ? { month: row.operation_month ?? null, year: row.operation_year ?? null }
            : null,
        title:
          verdict.symptom === "FAILED"
            ? "Importação falhou e deixou a base incompleta"
            : "Importação travada em andamento",
        description:
          `${SYMPTOM_TEXT[verdict.symptom]} Arquivo: ${String(row.filename ?? "não informado")}. ` +
          "Enquanto isso, os números do período podem estar parciais.",
        evidence: {
          importKind: kind,
          status: row.status,
          symptom: verdict.symptom,
          minutesRunning: verdict.minutesRunning,
          // Nome do arquivo é operacional (não é payload nem conteúdo).
          filename: String(row.filename ?? ""),
          navigationTarget: navigationTarget({
            module: kind === "BASE" ? "imports" : "checklists",
            importId: row.id,
            industryId: row.industry_id ?? null,
            month: row.operation_month ?? null,
            year: row.operation_year ?? null,
          }),
        },
        suggestedAction:
          verdict.symptom === "FAILED"
            ? "Corrigir a causa apontada no diagnóstico e reimportar o arquivo."
            : "Cancelar a importação travada e reprocessar o arquivo.",
        source: "detector:pending-import-conflict",
        fingerprintParts: { import: kind },
        contextParts: { status: row.status, symptom: verdict.symptom },
      });
    }

    return capDetections(issues, (hidden, total) => ({
      category: "IMPORTACAO" as const,
      issueType: SUMMARY_TYPE,
      severity: "CRITICO" as const,
      entityType: "SYSTEM",
      competence: null,
      title: "Muitas importações com problema",
      description: `${total} importações estão falhas ou travadas; ${hidden} não foram listadas individualmente.`,
      evidence: { count: total, hidden, navigationTarget: navigationTarget({ module: "imports" }) },
      suggestedAction: "Revisar a fila de importações e reprocessar os arquivos pendentes.",
      source: "detector:pending-import-conflict",
      fingerprintParts: { import: "summary" },
      contextParts: { total },
    }));
  },
};
