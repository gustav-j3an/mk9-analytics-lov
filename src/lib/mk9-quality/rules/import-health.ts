/**
 * MK9 — Fase 2B.2: regras PURAS de saúde das importações.
 *
 * Cobrem três perguntas objetivas:
 *   1. a importação travou ou falhou? (PENDING_IMPORT_CONFLICT)
 *   2. o checklist concluído foi validado por alguém? (CHECKLIST_IMPORT_WITHOUT_VALIDATION)
 *   3. o que o Excel disse bate com o que existe no banco? (EXCEL_DATABASE_DIVERGENCE)
 *
 * Nenhuma delas toca o banco: recebem fatos e devolvem decisão.
 */
import type { Mk9QualitySeverity } from "../types";

export type ImportHealthSymptom = "FAILED" | "STUCK_IN_PROGRESS" | "NEVER_FINISHED";

/** Uma importação em andamento por mais tempo que isto está travada. */
export const STUCK_MINUTES = 120;

const IN_PROGRESS = new Set(["pending", "previewing", "confirmed", "committing"]);

export interface ImportHealthFacts {
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ImportHealthEvaluation {
  symptom: ImportHealthSymptom;
  severity: Mk9QualitySeverity;
  minutesRunning: number;
}

export function evaluateImportHealth(
  facts: ImportHealthFacts,
  now: Date = new Date(),
): ImportHealthEvaluation | null {
  const status = String(facts.status ?? "").toLowerCase();
  const started = facts.startedAt ? Date.parse(facts.startedAt) : Number.NaN;
  const minutesRunning = Number.isFinite(started)
    ? Math.max(0, Math.round((now.getTime() - started) / 60000))
    : 0;

  if (status === "failed") {
    return { symptom: "FAILED", severity: "CRITICO", minutesRunning };
  }

  if (IN_PROGRESS.has(status)) {
    if (minutesRunning < STUCK_MINUTES) return null;
    // Mais de um dia parada: bloqueia decisões operacionais baseadas no arquivo.
    const severity: Mk9QualitySeverity = minutesRunning >= 1440 ? "CRITICO" : "ATENCAO";
    return { symptom: "STUCK_IN_PROGRESS", severity, minutesRunning };
  }

  if (status === "done" && !facts.finishedAt) {
    return { symptom: "NEVER_FINISHED", severity: "AVISO", minutesRunning };
  }

  return null;
}

export interface ChecklistValidationFacts {
  status: string;
  validationStatus: string | null;
  validatedAt: string | null;
  finishedAt: string | null;
}

/** Checklist concluído precisa ter validação humana registrada. */
export function needsChecklistValidation(facts: ChecklistValidationFacts): boolean {
  if (String(facts.status ?? "").toLowerCase() !== "done") return false;
  if (facts.validatedAt) return false;
  const validation = (facts.validationStatus ?? "").toUpperCase();
  return validation === "" || validation === "PENDING" || validation === "PENDENTE";
}

export interface CounterDivergence {
  metric: string;
  expected: number;
  actual: number;
  delta: number;
}

/**
 * Compara o que o arquivo declarou com o que realmente existe no banco.
 * Só reporta métricas presentes nos DOIS lados — contador ausente não é
 * divergência, é ausência de informação.
 */
export function compareCounters(
  expected: Record<string, unknown>,
  actual: Record<string, number>,
): CounterDivergence[] {
  const out: CounterDivergence[] = [];
  for (const [metric, actualValue] of Object.entries(actual)) {
    const raw = expected?.[metric];
    if (raw === null || raw === undefined) continue;
    const expectedValue = Number(raw);
    if (!Number.isFinite(expectedValue)) continue;
    if (expectedValue === actualValue) continue;
    out.push({
      metric,
      expected: expectedValue,
      actual: actualValue,
      delta: actualValue - expectedValue,
    });
  }
  return out.sort((a, b) => a.metric.localeCompare(b.metric));
}

/** Gravidade da divergência: proporcional ao tamanho relativo do desvio. */
export function divergenceSeverity(divergences: CounterDivergence[]): Mk9QualitySeverity {
  let worst = 0;
  for (const d of divergences) {
    const base = Math.max(1, Math.abs(d.expected));
    worst = Math.max(worst, Math.abs(d.delta) / base);
  }
  if (worst >= 0.2) return "CRITICO";
  if (worst >= 0.05) return "ATENCAO";
  return "AVISO";
}
