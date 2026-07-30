/**
 * MK9 — Fase 2B.2: proteção de volume dos detectores.
 *
 * Um detector nunca pode inundar o painel com milhares de ocorrências: além do
 * custo, isso destrói a capacidade de decisão. Quando o limite é ultrapassado,
 * o excedente vira UMA ocorrência-resumo.
 */
import type { DetectedIssue } from "../types";

export const MAX_ISSUES_PER_DETECTOR = 300;

export function capDetections(
  issues: DetectedIssue[],
  buildSummary: (hidden: number, total: number) => DetectedIssue,
  max: number = MAX_ISSUES_PER_DETECTOR,
): DetectedIssue[] {
  if (issues.length <= max) return issues;
  const kept = issues.slice(0, max);
  kept.push(buildSummary(issues.length - max, issues.length));
  return kept;
}
