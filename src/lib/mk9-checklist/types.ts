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
  storesFound: number;
  storesLinkedBySimilarity: number;
  storesNew: number;
  storesNotFound: number;
  validDates: number;
  invalidDates: number;
}

export interface ChecklistPreview {
  filename: string;
  industryId: string;
  industryName: string;
  operationMonth: number;
  operationYear: number;
  counters: ChecklistPreviewCounters;
  items: ChecklistItem[];
  warnings: string[];
}

export interface ChecklistCommitResult {
  importId: string;
  visitsPersisted: number;
  visitsSkipped: number;
  storesNotFound: number;
  invalidDates: number;
}
