/**
 * MK9 — Cockpit (Fase 3.1B): PREVISÃO de fechamento do período.
 *
 * Modelo ponderado aprovado na Fase 3.1A:
 *   ritmo = 40% ritmo médio do período inteiro + 60% ritmo das últimas 2 semanas
 * (o passado recente prevê melhor o fim do mês do que a média fria).
 *
 * Confiança:
 *   ALTA  → pelo menos 10 dias decorridos e histórico recente disponível
 *   MEDIA → pelo menos 5 dias decorridos
 *   BAIXA → período recém-iniciado (qualquer projeção é chute)
 *
 * Função pura: dias e visitas entram, projeção sai.
 */
import type { Mk9Forecast, Mk9ForecastConfidence } from "./types";

export const RECENT_WEIGHT = 0.6;
export const OVERALL_WEIGHT = 0.4;
export const RECENT_WINDOW_DAYS = 14;

export interface ForecastFacts {
  contracted: number;
  realizedToDate: number;
  realizedLastTwoWeeks: number;
  elapsedDays: number;
  totalDays: number;
}

export function forecastClose(facts: ForecastFacts): Mk9Forecast {
  const elapsed = Math.max(0, facts.elapsedDays);
  const total = Math.max(1, facts.totalDays);
  const daysRemaining = Math.max(0, total - elapsed);

  const dailyPaceOverall = elapsed > 0 ? facts.realizedToDate / elapsed : 0;
  const recentDays = Math.min(elapsed, RECENT_WINDOW_DAYS);
  const dailyPaceRecent =
    recentDays > 0 ? facts.realizedLastTwoWeeks / recentDays : dailyPaceOverall;

  const blended =
    elapsed === 0 ? 0 : dailyPaceOverall * OVERALL_WEIGHT + dailyPaceRecent * RECENT_WEIGHT;

  const projected = Math.round(facts.realizedToDate + blended * daysRemaining);
  const contracted = Math.max(0, facts.contracted);
  const gap = projected - contracted;

  const confidence: Mk9ForecastConfidence =
    elapsed >= 10 ? "ALTA" : elapsed >= 5 ? "MEDIA" : "BAIXA";

  const missing = Math.max(0, contracted - facts.realizedToDate);
  const requiredDailyPace =
    daysRemaining > 0
      ? Math.round((missing / daysRemaining) * 100) / 100
      : missing > 0
        ? missing
        : 0;

  return {
    projected,
    contracted,
    gap,
    projectedCoveragePct:
      contracted > 0 ? Math.min(200, Math.round((projected / contracted) * 100)) : 0,
    confidence,
    dailyPaceRecent: Math.round(dailyPaceRecent * 100) / 100,
    dailyPaceOverall: Math.round(dailyPaceOverall * 100) / 100,
    daysRemaining,
    requiredDailyPace,
  };
}
