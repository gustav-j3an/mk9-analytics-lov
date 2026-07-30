/**
 * Detector técnico 2 — FREQUENCY_OVERLAP_GUARD_STATUS (REALTIME / INFO).
 *
 * Confirma que as proteções estruturais da frequência versionada continuam
 * ativas (constraint de exclusão contra sobreposição e trigger de proteção da
 * projeção). Gera NO MÁXIMO uma ocorrência — nunca uma por registro.
 */
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "FREQUENCY_OVERLAP_GUARD_STATUS";

export const frequencyOverlapGuardDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "INTEGRIDADE",
  mode: "REALTIME",
  issueTypes: [ISSUE_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    // Categoria técnica: nunca exposta a CLIENTE/PROMOTOR.
    if (ctx.scope.role === "CLIENTE" || ctx.scope.role === "PROMOTOR") return [];

    const { data, error } = await ctx.supabase.rpc("mk9_quality_guard_status");
    if (error) throw new Error("MK9_DQ_DETECTOR_FAILED");

    const status = (data ?? {}) as {
      overlapConstraint?: boolean;
      projectionGuardTrigger?: boolean;
      overlappingRows?: number;
    };
    const overlapping = Number(status.overlappingRows ?? 0);
    const healthy =
      status.overlapConstraint === true &&
      status.projectionGuardTrigger === true &&
      overlapping === 0;

    if (healthy) return [];

    return [
      {
        category: "INTEGRIDADE" as const,
        issueType: ISSUE_TYPE,
        severity: overlapping > 0 ? ("BLOQUEANTE" as const) : ("CRITICO" as const),
        entityType: "SYSTEM",
        title: "Proteções da frequência versionada não estão íntegras",
        description:
          "A proteção contra vigências sobrepostas ou o bloqueio de escrita direta na " +
          "projeção não está ativa. Sem elas, os números contratados podem ser corrompidos.",
        evidence: {
          overlapConstraint: status.overlapConstraint === true,
          projectionGuardTrigger: status.projectionGuardTrigger === true,
          overlappingRows: overlapping,
        },
        suggestedAction:
          "Restaurar a constraint de exclusão de vigências e o trigger de proteção da projeção.",
        source: "detector:frequency-overlap-guard",
        fingerprintParts: { guard: "frequency-versions" },
        contextParts: {
          overlapConstraint: status.overlapConstraint === true,
          projectionGuardTrigger: status.projectionGuardTrigger === true,
          overlappingRows: overlapping,
        },
      },
    ];
  },
};
