// Tipos de domínio MK9. Portáveis: nada de Supabase/Prisma aqui.
// Weekday: 0=domingo ... 6=sábado (padrão JS Date.getDay()).
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SyncMode = "full" | "add_only" | "registry_only" | "routes_only";

export type IndustryStatus =
  | "DENTRO DA META"
  | "ACIMA DA META"
  | "ABAIXO DA META"
  | "SEM META"
  | "OK";

export interface IndustryRecord {
  id?: string;
  name: string;
  nameNormalized: string;
  monthlyContractedFrequency?: number | null;
  monthlyEstimatedFrequency?: number | null;
  frequencyDifference?: number | null;
  frequencyStatus?: IndustryStatus | null;
  weeksCount?: number | null;
}

export interface StoreRecord {
  id?: string;
  chain?: string | null;
  name: string;
  nameNormalized: string;
  uf?: string | null;
}

export interface PromoterRecord {
  id?: string;
  externalId?: string | null;
  name: string;
  nameNormalized: string;
  city?: string | null;
  contact?: string | null;
  contactNormalized?: string | null;
  notes?: string | null;
}

export interface PlannedRouteRecord {
  id?: string;
  promoterId: string;
  storeId: string;
  industryId: string;
  weekday: Weekday;
  operationMonth: number;
  operationYear: number;
  sourceSheet?: string | null;
}

export interface PlannedVisitRecord {
  id?: string;
  promoterId: string;
  storeId: string;
  industryId: string;
  routeId?: string | null;
  scheduledDate: string; // ISO yyyy-mm-dd
  status: "planned" | "completed" | "cancelled" | "skipped";
  sourceSheet?: string | null;
}

export type ImportItemAction =
  | "create"
  | "update"
  | "keep"
  | "remove"
  | "invalid"
  | "ambiguous"
  | "duplicate"
  | "conflict"
  | "preserved";

export type EntityType = "industry" | "store" | "promoter" | "frequency" | "route" | "visit";

export interface ImportItem {
  sheet: string;
  excelRow?: number;
  entityType: EntityType;
  action: ImportItemAction;
  // JSON-serializable
  payload: Record<string, any>;
  resolvedIds?: Record<string, string | null>;
  warnings?: string[];
}


export interface PreviewCounters {
  industriesCreated: number;
  industriesUpdated: number;
  storesCreated: number;
  storesUpdated: number;
  promotersCreated: number;
  promotersUpdated: number;
  routesCreated: number;
  routesUpdated: number;
  routesKept: number;
  routesRemoved: number;
  visitsCreated: number;
  visitsUpdated: number;
  visitsKept: number;
  visitsRemoved: number;
  visitsPreserved: number;
  duplicates: number;
  invalid: number;
  ambiguous: number;
  conflicts: number;
}

export interface ImportPreview {
  filename: string;
  fileHash?: string;
  operationMonth: number;
  operationYear: number;
  syncMode: SyncMode;
  sheetsAnalyzed: string[];
  counters: PreviewCounters;
  items: ImportItem[];
}
