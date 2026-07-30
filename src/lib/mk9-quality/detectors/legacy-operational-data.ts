/**
 * Detector técnico 3 — LEGACY_OPERATIONAL_DATA (PERSISTED / INFO).
 *
 * UMA única ocorrência informativa com as contagens do legado operacional.
 * Decisão da Fase 2A: nada é removido, arquivado ou migrado — o detector
 * apenas mantém a visibilidade do volume.
 */
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "LEGACY_OPERATIONAL_DATA";

export const legacyOperationalDataDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "INTEGRIDADE",
  mode: "PERSISTED",
  issueTypes: [ISSUE_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    if (ctx.scope.role === "CLIENTE" || ctx.scope.role === "PROMOTOR") return [];

    const { data, error } = await ctx.supabase.rpc("mk9_quality_legacy_counts");
    if (error) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const counts = (data ?? {}) as { plannedVisits?: number; visitReconciliations?: number };
    const plannedVisits = Number(counts.plannedVisits ?? 0);
    const visitReconciliations = Number(counts.visitReconciliations ?? 0);
    if (plannedVisits === 0 && visitReconciliations === 0) return [];

    return [
      {
        category: "INTEGRIDADE" as const,
        issueType: ISSUE_TYPE,
        severity: "INFO" as const,
        entityType: "SYSTEM",
        title: "Dados operacionais legados ainda presentes",
        description:
          "Existem registros das estruturas antigas de visitas planejadas e conciliações. " +
          "Eles não afetam os números atuais e são mantidos por decisão operacional.",
        evidence: { plannedVisits, visitReconciliations },
        suggestedAction:
          "Nenhuma ação automática. Avaliar destino do legado em fase futura, se desejado.",
        source: "detector:legacy-operational-data",
        fingerprintParts: { legacy: "planned-visits+reconciliations" },
        contextParts: { plannedVisits, visitReconciliations },
      },
    ];
  },
};
