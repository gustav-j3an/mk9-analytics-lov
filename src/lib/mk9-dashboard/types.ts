// Tipos do Dashboard Operacional MK9 (compartilhados server/client).
//
// Fase 3.1B: as linhas operacionais passaram a viver no núcleo compartilhado
// (`src/lib/mk9-operations/types.ts`). Aqui apenas re-exportamos com os nomes
// históricos — a interface existente não muda.

export { INDUSTRY_STATUS_LABEL, INDUSTRY_STATUS_ORDER } from "@/lib/mk9-operations/types";

export type {
  IndustryStatusKey,
  StoreExecStatus,
  PromoterResolution,
  OperationStoreRow as DashboardStoreRow,
  OperationIndustryRow as DashboardIndustryRow,
  OperationFilters as DashboardFilters,
} from "@/lib/mk9-operations/types";

import type {
  IndustryStatusKey,
  OperationIndustryRow,
  OperationStoreRow,
  StoreExecStatus,
} from "@/lib/mk9-operations/types";

export type AlertSeverity = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";

export type AlertKind =
  | "INDUSTRIA_CRITICA"
  | "CHECKLIST_NAO_IMPORTADO"
  | "LOJA_SEM_VISITA"
  | "LOJA_ABAIXO_FREQUENCIA"
  | "VISITA_UNASSIGNED"
  | "VISITA_AMBIGUOUS"
  | "FREQUENCIA_NAO_CADASTRADA"
  | "INDUSTRIA_ABAIXO_META"
  | "PROMOTOR_CRITICO";

export interface PaceBlock {
  contractedTotal: number;
  expectedToDate: number;
  realizedToDate: number;
  deviation: number;
  pacePercentage: number;
}

export interface DashboardKpis extends PaceBlock {
  realizadas: number;
  pendentes: number;
  extras: number;
  coberturaPct: number;
  lojasContratadas: number;
  lojasAtendidas: number;
  lojasSemVisita: number;
  industriasTotal: number;
  industriasEmRisco: number;
  visitasSemPromotor: number;
}

export interface DashboardPromoterRow {
  promoterId: string | null;
  promoterName: string;
  storesCount: number;
  industriesCount: number;
  expectedToDate: number;
  realizadas: number;
  coberturaPct: number;
  storesWithoutVisit: number;
  visitsOffSchedule: number;
  status: "EM_DIA" | "ATENCAO" | "CRITICA" | "NAO_RESOLVIDO";
}

export interface DashboardSeriesPoint {
  date: string;
  expected: number;
  realized: number;
  diff: number;
}

export interface DashboardAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  description: string;
  industryId: string | null;
  storeId: string | null;
  promoterId: string | null;
  uf: string | null;
}

export interface DashboardOverview {
  generatedAt: string;
  today: string;
  periodLabel: string;
  windowStart: string;
  windowEnd: string;
  usesHistoricalFrequency: boolean;
  checklistImports: number;
  kpis: DashboardKpis;
  industries: OperationIndustryRow[];
  criticalStores: OperationStoreRow[];
  criticalStoresTotal: number;
  promoters: DashboardPromoterRow[];
  series: DashboardSeriesPoint[];
  alerts: DashboardAlert[];
  alertsTotal: number;
  storeExecutionDistribution: Array<{ key: StoreExecStatus; label: string; value: number }>;
  industryStatusDistribution: Array<{ key: IndustryStatusKey; label: string; value: number }>;
  availableUfs: string[];
}
