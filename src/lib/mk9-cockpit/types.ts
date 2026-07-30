/**
 * MK9 — Cockpit Operacional (Fase 3.1B): contratos do payload.
 *
 * O payload é FECHADO: nada de linha bruta do banco chega ao navegador.
 */
import type { IndustryStatusKey, OperationSeriesPoint } from "@/lib/mk9-operations/types";

export type Mk9HealthLevel = "BLOQUEADA" | "CRITICA" | "ATENCAO" | "SAUDAVEL";

export interface Mk9HealthVerdict {
  level: Mk9HealthLevel;
  headline: string;
  reason: string;
  pacePercentage: number;
  blockingIssues: number;
  overdueIssues: number;
  failedImports: number;
}

export type Mk9PriorityKind =
  | "OCORRENCIA_BLOQUEANTE"
  | "OCORRENCIA_VENCIDA"
  | "IMPORTACAO_FALHA"
  | "INDUSTRIA_CRITICA"
  | "LOJA_SEM_VISITA"
  | "PROMOTOR_CRITICO";

export interface Mk9PriorityItem {
  id: string;
  kind: Mk9PriorityKind;
  score: number;
  title: string;
  description: string;
  impact: number;
  industryId: string | null;
  storeId: string | null;
  promoterId: string | null;
  deepLink: string | null;
}

export type Mk9ForecastConfidence = "ALTA" | "MEDIA" | "BAIXA";

export interface Mk9Forecast {
  projected: number;
  contracted: number;
  gap: number;
  projectedCoveragePct: number;
  confidence: Mk9ForecastConfidence;
  dailyPaceRecent: number;
  dailyPaceOverall: number;
  daysRemaining: number;
  requiredDailyPace: number;
}

export interface Mk9CockpitIndustry {
  industryId: string;
  industryName: string;
  status: IndustryStatusKey;
  contratadas: number;
  realizadas: number;
  expectedToDate: number;
  coberturaPct: number;
  pacePercentage: number;
  openIssues: number;
}

export interface Mk9CockpitOverview {
  generatedAt: string;
  today: string;
  periodLabel: string;
  windowStart: string;
  windowEnd: string;
  health: Mk9HealthVerdict;
  kpis: {
    contratadas: number;
    realizadas: number;
    expectedToDate: number;
    pendentes: number;
    coberturaPct: number;
    pacePercentage: number;
    lojasSemVisita: number;
    industriasEmRisco: number;
    ocorrenciasAbertas: number;
    ocorrenciasVencidas: number;
  };
  forecast: Mk9Forecast;
  priorities: Mk9PriorityItem[];
  industries: Mk9CockpitIndustry[];
  series: OperationSeriesPoint[];
  availableUfs: string[];
  perf: { totalMs: number; coreMs: number; queryCount: number };
}
