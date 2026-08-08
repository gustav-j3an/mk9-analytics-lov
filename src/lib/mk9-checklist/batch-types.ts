import type { ChecklistPreview } from "./types";

export type BatchStatus =
  | "DRAFT"
  | "ANALYZING"
  | "READY"
  | "PROCESSING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";

export interface ChecklistBatchFile {
  id: string;
  filename: string;
  industryId?: string;
  industryName?: string;
  operationMonth: number;
  operationYear: number;
  status:
    | "PENDING"
    | "ANALYZING"
    | "READY"
    | "NEEDS_REVIEW"
    | "DUPLICATE"
    | "INVALID"
    | "ERROR"
    | "IMPORTED"
    | "FAILED";
  preview?: ChecklistPreview;
  error?: string;
  warnings: string[];
  hash?: string;
}

export interface ChecklistBatch {
  id: string;
  status: BatchStatus;
  totalFiles: number;
  readyFiles: number;
  importedFiles: number;
  reviewFiles: number;
  failedFiles: number;
  files: ChecklistBatchFile[];
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}
