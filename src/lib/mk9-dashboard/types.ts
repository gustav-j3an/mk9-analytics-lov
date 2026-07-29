// Tipos do Dashboard Operacional MK9 (compartilhados server/client).

export type IndustryStatusKey =
  | "CONCLUIDA"
  | "EM_DIA"
  | "ATENCAO"
  | "CRITICA"
  | "SEM_CHECKLIST"
  | "SEM_FREQUENCIA";

export const INDUSTRY_STATUS_LABEL: Record<IndustryStatusKey, string> = {
  CONCLUIDA: "Concluída",
  EM_DIA: "Em dia",
  ATENCAO: "Atenção",
  CRITICA: "Crítica",
  SEM_CHECKLIST: "Sem checklist",
  SEM_FREQUENCIA: "Sem frequência",
};

export const INDUSTRY_STATUS_ORDER: IndustryStatusKey[] = [
  "CRITICA",
  "SEM_CHECKLIST",
  "ATENCAO",
  "EM_DIA",
  "CONCLUIDA",
  "SEM_FREQUENCIA",
];

export type StoreExecStatus = "INTEGRAL" | "PARCIAL" | "NAO_ATENDIDA";
export type PromoterResolution = "MATCHED_ROUTE" | "AMBIGUOUS_ROUTE" | "UNASSIGNED_ROUTE";
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

export interface DashboardFilters {
  year: number;
  month: number;
  industryId?: string | null;
  uf?: string | null;
  promoterId?: string | null;
  supervisorUserId?: string | null;
  /** Escopo de acesso resolvido no servidor (Fase 0.2). Nunca vem do navegador. */
  access?: {
    allowedIndustryIds: string[] | null;
    allowedUfs: string[] | null;
    allowedStoreIds: string[] | null;
    allowedPromoterIds: string[] | null;
    canViewPersonalData: boolean;
  } | null;
}


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

export interface DashboardIndustryRow {
  industryId: string;
  industryName: string;
  windowStart: string;
  windowEnd: string;
  totalDays: number;
  elapsedDays: number;
  isHistorical: boolean;
  lojasContratadas: number;
  lojasAtendidas: number;
  contratadas: number;
  expectedToDate: number;
  realizadas: number;
  pendentes: number;
  coberturaPct: number;
  deviation: number;
  pacePercentage: number;
  status: IndustryStatusKey;
  checklistImports: number;
}

export interface DashboardStoreRow {
  storeId: string;
  storeName: string;
  chain: string | null;
  uf: string | null;
  industryId: string;
  industryName: string;
  weeklyFrequency: number | null;
  monthlyFrequency: number | null;
  contratadas: number;
  expectedToDate: number;
  realizadas: number;
  pendentes: number;
  lastVisit: string | null;
  daysWithoutVisit: number | null;
  promoterId: string | null;
  promoterName: string | null;
  promoterResolution: PromoterResolution;
  status: StoreExecStatus;
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
  industries: DashboardIndustryRow[];
  criticalStores: DashboardStoreRow[];
  criticalStoresTotal: number;
  promoters: DashboardPromoterRow[];
  series: DashboardSeriesPoint[];
  alerts: DashboardAlert[];
  alertsTotal: number;
  storeExecutionDistribution: Array<{ key: StoreExecStatus; label: string; value: number }>;
  industryStatusDistribution: Array<{ key: IndustryStatusKey; label: string; value: number }>;
  availableUfs: string[];
}
