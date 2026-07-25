// Port (interface) do repositório. A camada de sincronização depende dela,
// não da implementação. Portamos para Prisma criando outro adapter.
import type {
  IndustryRecord,
  PlannedRouteRecord,
  PlannedVisitRecord,
  PromoterRecord,
  StoreRecord,
  ImportItem,
  ImportPreview,
  SyncMode,
} from "./types";

export interface Mk9Repository {
  // reads
  listIndustries(): Promise<IndustryRecord[]>;
  listStores(): Promise<StoreRecord[]>;
  listPromoters(): Promise<PromoterRecord[]>;
  listPlannedRoutes(month: number, year: number): Promise<PlannedRouteRecord[]>;
  listPlannedVisits(month: number, year: number): Promise<PlannedVisitRecord[]>;

  // writes — todas idempotentes por chave lógica
  upsertIndustries(records: IndustryRecord[], importId: string): Promise<IndustryRecord[]>;
  upsertStores(records: StoreRecord[], importId: string): Promise<StoreRecord[]>;
  upsertPromoters(records: PromoterRecord[], importId: string): Promise<PromoterRecord[]>;
  upsertPlannedRoutes(records: PlannedRouteRecord[], importId: string): Promise<PlannedRouteRecord[]>;
  removePlannedRoutes(ids: string[]): Promise<void>;
  upsertPlannedVisits(records: PlannedVisitRecord[], importId: string): Promise<PlannedVisitRecord[]>;
  removeFuturePlannedVisits(ids: string[]): Promise<void>;

  // imports
  createImport(input: {
    filename: string;
    fileHash?: string | null;
    operationMonth: number;
    operationYear: number;
    syncMode: SyncMode;
    sheetsAnalyzed: string[];
    userId?: string | null;
  }): Promise<{ id: string }>;
  savePreview(importId: string, preview: ImportPreview): Promise<void>;
  saveImportItems(importId: string, items: ImportItem[]): Promise<void>;
  updateImportStatus(importId: string, patch: {
    status?: "pending" | "previewing" | "confirmed" | "committing" | "done" | "failed" | "cancelled";
    counters?: Record<string, number>;
    errorMessage?: string | null;
    finishedAt?: Date;
    durationMs?: number;
  }): Promise<void>;
  listImports(limit?: number): Promise<Array<{
    id: string;
    filename: string;
    operationMonth: number;
    operationYear: number;
    syncMode: SyncMode;
    status: string;
    counters: Record<string, number>;
    sheetsAnalyzed: string[];
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
  }>>;
  getImport(id: string): Promise<{ preview: ImportPreview | null; items: ImportItem[] } | null>;
}
