/**
 * MK9 — Cockpit (Fase 3.1B): motor de PRIORIDADES (score 0-100).
 *
 * Regra: o cockpit mostra as 5 maiores dores do dia, e a ordem precisa ser
 * explicável. Score = peso da classe + impacto normalizado.
 *
 *   OCORRENCIA_BLOQUEANTE 90 · IMPORTACAO_FALHA 85 · OCORRENCIA_VENCIDA 70
 *   INDUSTRIA_CRITICA 65 · PROMOTOR_CRITICO 50 · LOJA_SEM_VISITA 40
 *
 * O impacto (visitas em risco / dias de atraso) soma até +10 pontos, então
 * uma classe nunca ultrapassa a classe imediatamente superior.
 * Empate é resolvido por impacto e depois por id — ordenação estável.
 */
import type { Mk9PriorityItem, Mk9PriorityKind } from "./types";

export const KIND_WEIGHT: Record<Mk9PriorityKind, number> = {
  OCORRENCIA_BLOQUEANTE: 90,
  IMPORTACAO_FALHA: 85,
  OCORRENCIA_VENCIDA: 70,
  INDUSTRIA_CRITICA: 65,
  PROMOTOR_CRITICO: 50,
  LOJA_SEM_VISITA: 40,
};

/** Impacto vira bônus de 0 a 10 com retorno decrescente (log). */
export function impactBonus(impact: number): number {
  if (impact <= 0) return 0;
  return Math.min(10, Math.round(Math.log10(1 + impact) * 6 * 10) / 10);
}

export function scoreFor(kind: Mk9PriorityKind, impact: number): number {
  return Math.min(100, Math.round((KIND_WEIGHT[kind] + impactBonus(impact)) * 10) / 10);
}

export function rankPriorities(items: Mk9PriorityItem[], limit = 5): Mk9PriorityItem[] {
  return items
    .slice()
    .sort((a, b) => b.score - a.score || b.impact - a.impact || a.id.localeCompare(b.id))
    .slice(0, limit);
}
