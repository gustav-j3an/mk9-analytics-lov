export type ReconciliationStatus =
  | "MATCHED"
  | "DATE_DIVERGENCE"
  | "UNPLANNED_VISIT"
  | "NOT_COMPLETED"
  | "STORE_NOT_FOUND"
  | "AMBIGUOUS"
  | "DUPLICATE_ACTUAL"
  | "MANUALLY_MATCHED"
  | "IGNORED";

export type MatchType = "EXACT" | "NEAR_DATE" | "MANUAL" | "NONE";

export interface ReconciliationSummary {
  planned: number;
  actual: number;
  matched: number;
  dateDivergence: number;
  unplanned: number;
  notCompleted: number;
  ambiguous: number;
  storeNotFound: number;
  duplicate: number;
  manuallyMatched: number;
  ignored: number;
  coveragePct: number;
  /** Camada canônica de métricas (contratadas/executadas/válidas/extras/pendências). */
  metrics: {
    contratadas: number;
    executadas: number;
    validas: number;
    extras: number;
    pendencias: number;
    coberturaPct: number;
  };
}

export const STATUS_LABELS_PT: Record<ReconciliationStatus, string> = {
  MATCHED: "Conciliada",
  DATE_DIVERGENCE: "Data divergente",
  UNPLANNED_VISIT: "Fora do roteiro",
  NOT_COMPLETED: "Não realizada",
  STORE_NOT_FOUND: "Loja não encontrada",
  AMBIGUOUS: "Ambígua",
  DUPLICATE_ACTUAL: "Realizada duplicada",
  MANUALLY_MATCHED: "Conciliada manualmente",
  IGNORED: "Ignorada",
};

export const NEAR_DATE_WINDOW_DAYS = 3;
export const NEAR_DATE_SCORE: Record<number, number> = { 1: 90, 2: 80, 3: 70 };
