// Tipos do versionamento de frequência (Fase 1B.2).
// Espelham a filosofia já usada no módulo de Roteiros.

export type FrequencyDiffKind =
  | "UNCHANGED"
  | "NEW_FREQUENCY"
  | "CHANGED_FREQUENCY"
  | "REMOVED_FROM_IMPORT"
  | "MANUAL_CONFLICT"
  | "FUTURE_VERSION_CONFLICT";

export interface IncomingFrequency {
  storeId: string;
  weeklyFrequency: number | null;
  monthlyFrequency: number | null;
  /** Chave da linha de origem no Excel (`storeNormalized|uf`), quando conhecida. */
  storeKey?: string;
  /** Como a linha foi associada à loja: correspondência exata ou por similaridade. */
  matchKind?: "EXACT" | "SIMILARITY";
  /** Uso interno do dedup para desempate estável. */
  sourceIndex?: number;
}

export interface FrequencyVersionPayload {
  industry_id: string;
  store_id: string;
  weekly_frequency: number | null;
  monthly_frequency: number | null;
}

export interface FrequencyDiffItem {
  kind: FrequencyDiffKind;
  storeId: string;
  storeName: string | null;
  storeUf: string | null;
  currentVersionId: string | null;
  currentSourceType: string | null;
  currentWeekly: number | null;
  currentMonthly: number | null;
  incomingWeekly: number | null;
  incomingMonthly: number | null;
  newVersion: FrequencyVersionPayload | null;
  competencyStart: string;
  reason?: string;
}

export interface FrequencyDiffReport {
  competencyStart: string;
  totalIncoming: number;
  unchanged: number;
  new: number;
  changed: number;
  removed: number;
  manualConflicts: number;
  futureConflicts: number;
  items: FrequencyDiffItem[];
}

export interface FrequencyApplyResult {
  unchanged: number;
  new: number;
  changed: number;
  removed: number;
  skipped: number;
  forced: number;
}
