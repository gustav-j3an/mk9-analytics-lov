/**
 * MK9 — Núcleo operacional compartilhado (Fase 3.1B): contratos.
 *
 * Estes tipos são a FONTE ÚNICA das linhas operacionais (loja e indústria).
 * `src/lib/mk9-dashboard/types.ts` apenas os re-exporta com os nomes antigos,
 * para não quebrar a interface existente.
 */
import type { FrequencySegmentInput } from "@/lib/mk9-frequency/segments";

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

/** Escopo de acesso resolvido no servidor (Fase 0.2). Nunca vem do navegador. */
export interface OperationAccess {
  allowedIndustryIds: string[] | null;
  allowedUfs: string[] | null;
  allowedStoreIds: string[] | null;
  allowedPromoterIds: string[] | null;
  canViewPersonalData: boolean;
}

export interface OperationFilters {
  year: number;
  month: number;
  industryId?: string | null;
  uf?: string | null;
  promoterId?: string | null;
  supervisorUserId?: string | null;
  access?: OperationAccess | null;
}

export interface OperationWindow {
  startDate: string;
  endDate: string;
  totalDays: number;
}

export interface OperationStoreRow {
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
  promoterEmployeeNumber: string | null;
  status: StoreExecStatus;
}

export interface OperationIndustryRow {
  industryId: string;
  industryName: string;
  windowStart: string;
  windowEnd: string;
  totalDays: number;
  elapsedDays: number;
  isHistorical: boolean;
  lojasContratadas: number;
  lojasAtendidas: number;
  zeradasCount: number;
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

/** Bucket por (indústria, loja): vigências que interceptam a janela + visitas. */
export interface StoreBucket {
  storeId: string;
  storeName: string;
  chain: string | null;
  uf: string | null;
  weekly: number | null;
  monthly: number | null;
  segments: FrequencySegmentInput[];
  visits: string[];
}

export interface IndustryContext {
  id: string;
  name: string;
  /** Participa do fluxo operacional de checklist (não indica indústria inativa). */
  requiresChecklist: boolean;
  /** Data de habilitação: impede cobrança de checklist em competências anteriores. */
  checklistEnabledAt: string | null;

  win: OperationWindow;
  fraction: number;
  buckets: Map<string, StoreBucket>;
  checklistImports: number;
}

export interface RouteInfo {
  votes: Map<string, { name: string; count: number }>;
  weekdays: Set<number>;
}

export interface ResolvedPromoter {
  id: string | null;
  name: string | null;
  resolution: PromoterResolution;
}

/** Resultado do núcleo — consumido por Dashboard e Cockpit sem recálculo. */
export interface OperationCore {
  today: string;
  year: number;
  month: number;
  globalStart: string;
  globalEnd: string;
  /** true quando o escopo/filtro não deixou nada visível. */
  empty: boolean;
  ctxs: IndustryContext[];
  ctxById: Map<string, IndustryContext>;
  routeByKey: Map<string, RouteInfo>;
  storeRows: OperationStoreRow[];
  industryRows: OperationIndustryRow[];
  availableUfs: string[];
  industryIds: string[];
  checklistImportsTotal: number;
  /** Telemetria de performance do núcleo. */
  queryCount: number;
  coreMs: number;
}

export interface OperationSeriesPoint {
  date: string;
  expected: number;
  realized: number;
  diff: number;
}
