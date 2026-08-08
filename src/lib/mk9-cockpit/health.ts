/**
 * MK9 — Cockpit (Fase 3.1B): árvore de decisão DETERMINÍSTICA de saúde.
 *
 * Ordem fixa (a primeira condição verdadeira vence):
 *   1. BLOQUEADA → existe ocorrência BLOQUEANTE aberta ou importação falha
 *                  na competência: decidir com esses dados é arriscado.
 *   2. CRITICA   → ritmo < 80% do esperado até hoje.
 *   3. ATENCAO   → ritmo < 95%, ou há ocorrências vencidas (SLA estourado).
 *   4. SAUDAVEL  → nada acima.
 *
 * Função pura: recebe fatos, devolve veredito. Sem I/O, sem data implícita.
 */
import type { Mk9HealthLevel, Mk9HealthVerdict } from "./types";

export const CRITICAL_PACE = 80;
export const ATTENTION_PACE = 95;

export interface HealthFacts {
  pacePercentage: number;
  expectedToDate: number;
  realizedToDate: number;
  blockingIssues: number;
  overdueIssues: number;
  failedImports: number;
}

const HEADLINE: Record<Mk9HealthLevel, string> = {
  BLOQUEADA: "Operação bloqueada",
  CRITICA: "Operação crítica",
  ATENCAO: "Operação em atenção",
  SAUDAVEL: "Operação saudável",
};

export function evaluateHealth(facts: HealthFacts): Mk9HealthVerdict {
  const base = {
    pacePercentage: facts.pacePercentage,
    blockingIssues: facts.blockingIssues,
    overdueIssues: facts.overdueIssues,
    failedImports: facts.failedImports,
  };
  const verdict = (level: Mk9HealthLevel, reason: string): Mk9HealthVerdict => ({
    level,
    headline: HEADLINE[level],
    reason,
    ...base,
  });

  if (facts.blockingIssues > 0) {
    return verdict(
      "BLOQUEADA",
      `${facts.blockingIssues} ocorrência(s) bloqueante(s) impedem confiar nos números do período.`,
    );
  }
  if (facts.failedImports > 0) {
    return verdict(
      "BLOQUEADA",
      `${facts.failedImports} importação(ões) de checklist falharam nesta competência.`,
    );
  }
  if (facts.expectedToDate > 0 && facts.pacePercentage < CRITICAL_PACE) {
    return verdict(
      "CRITICA",
      `Ritmo em ${facts.pacePercentage}%: ${facts.realizedToDate} de ${facts.expectedToDate} visitas esperadas até hoje.`,
    );
  }
  if (facts.expectedToDate > 0 && facts.pacePercentage < ATTENTION_PACE) {
    return verdict("ATENCAO", `Ritmo em ${facts.pacePercentage}%, abaixo da meta proporcional.`);
  }
  if (facts.overdueIssues > 0) {
    return verdict(
      "ATENCAO",
      `${facts.overdueIssues} ocorrência(s) com prazo vencido aguardando tratamento.`,
    );
  }
  return verdict(
    "SAUDAVEL",
    facts.expectedToDate > 0
      ? `Ritmo em ${facts.pacePercentage}% e nenhum bloqueio aberto.`
      : "Período ainda não iniciou e não há bloqueios abertos.",
  );
}
