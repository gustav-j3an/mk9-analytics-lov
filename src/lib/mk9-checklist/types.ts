// Tipos do módulo Importador de Checklists das Indústrias.
// Camada pura, sem dependências de banco.

export type ChecklistRowStatus =
  | "found"
  | "linked_by_similarity"
  | "new_store"
  | "store_not_found"
  | "invalid_date";

export interface ChecklistMark {
  storeName: string;
  storeNormalized: string;
  uf: string | null;
  weeklyFrequency: number | null;
  monthlyFrequency: number | null;
  day: number;
  scheduledDate: string; // ISO yyyy-mm-dd, extraída direto do cabeçalho
  excelRow: number;
}

export interface ChecklistItem {
  excelRow: number;
  storeName: string;
  storeNormalized: string;
  uf: string | null;
  storeId: string | null;
  scheduledDate: string; // yyyy-mm-dd
  status: ChecklistRowStatus;
  message?: string;
  similarityScore?: number;
  matchedStoreName?: string;
}

export interface ChecklistPreviewCounters {
  totalStores: number;
  totalMarks: number;
  totalContractedFrequency: number;
  storesFound: number;
  storesLinkedBySimilarity: number;
  storesNew: number;
  storesNotFound: number;
  validDates: number;
  invalidDates: number;
  frequenciesNotImported: number;
  duplicateStoreNames: number;
}

export interface ChecklistStoreFrequency {
  storeName: string;
  storeNormalized: string;
  uf: string | null;
  storeId: string | null;
  status: ChecklistRowStatus;
  matchedStoreName?: string;
  similarityScore?: number;
  weeklyFrequency: number | null;
  monthlyFrequency: number | null;
  excelRow?: number;
}

export type ChecklistValidationStatus = "CONSISTENT" | "COMPLETED_WITH_ALERTS" | "INCONSISTENT" | "FAILED";

export interface ChecklistStoreValidation {
  storeName: string;
  storeNormalized: string;
  uf: string | null;
  storeId: string | null;
  declared: number | null;
  parsed: number;
  persisted: number | null;
  diffParsedVsDeclared: number | null;
  diffPersistedVsParsed: number | null;
  status: "OK" | "PARSE_DIVERGENCE" | "PERSIST_DIVERGENCE" | "STORE_NOT_FOUND" | "AMBIGUOUS_STORE";
  dates: string[];
  persistedDates?: string[];
  missingDates?: string[];
  extraDates?: string[];
  message?: string;
}

export interface ChecklistValidationReport {
  status: ChecklistValidationStatus;
  declaredTotal: number | null;
  declaredSum: number;
  parsedTotal: number;
  persistedTotal: number | null;
  unmatchedStoreTotal: number;
  invalidDateTotal: number;
  duplicateRowTotal: number;
  stores: ChecklistStoreValidation[];
  summaryLines: string[];
  validatedAt: string;
}

export interface ChecklistPreview {
  filename: string;
  industryId: string;
  industryName: string;
  operationMonth: number;
  operationYear: number;
  counters: ChecklistPreviewCounters;
  items: ChecklistItem[];
  storeFrequencies: ChecklistStoreFrequency[];
  warnings: string[];
  validation?: ChecklistValidationReport;
}

export interface ChecklistCommitResult {
  importId: string;
  visitsPersisted: number;
  visitsSkipped: number;
  storesNotFound: number;
  invalidDates: number;
  validation?: ChecklistValidationReport;
}
