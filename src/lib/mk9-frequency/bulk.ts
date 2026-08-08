/**
 * MK9 — Cadastro em lote de frequências e conferência contrato × distribuição.
 *
 * TUDO aqui é PURO (sem I/O) para poder ser testado e para o servidor e a
 * interface usarem exatamente as mesmas regras. O servidor SEMPRE reexecuta
 * estas funções com dados relidos do banco — a seleção enviada pelo navegador
 * nunca é confiada.
 *
 * Invariantes:
 *  - o modelo continua sendo frequência por indústria × loja;
 *  - nada é apagado: cada mudança cria uma nova vigência;
 *  - o total distribuído usa exclusivamente `contractedVisitsForFrequencySegments`;
 *  - conflito manual e conflito futuro nunca são sobrescritos silenciosamente.
 */
import { z } from "zod";

import { contractedVisitsForFrequencySegments, type FrequencySegmentInput } from "./segments";

// ---------------------------------------------------------------------------
// Modos de aplicação
// ---------------------------------------------------------------------------
export type BulkApplyMode =
  /** A. Somente lojas sem frequência vigente. */
  | "ONLY_WITHOUT"
  /** B. Substituir frequência a partir da data escolhida. */
  | "REPLACE_FROM_DATE"
  /** C. Criar versão futura (data de início posterior a hoje). */
  | "FUTURE_VERSION"
  /** D. Atualizar somente as lojas selecionadas manualmente. */
  | "SELECTED_ONLY";

export const BULK_MODE_LABEL: Record<BulkApplyMode, string> = {
  ONLY_WITHOUT: "Somente lojas sem frequência vigente",
  REPLACE_FROM_DATE: "Substituir a partir da data escolhida",
  FUTURE_VERSION: "Criar versão futura",
  SELECTED_ONLY: "Somente as lojas selecionadas",
};

export type BulkItemKind =
  | "UNCHANGED"
  | "SKIPPED"
  | "NEW_FREQUENCY"
  | "CHANGED_FREQUENCY"
  | "MANUAL_CONFLICT"
  | "FUTURE_VERSION_CONFLICT";

export const BULK_KIND_LABEL: Record<BulkItemKind, string> = {
  UNCHANGED: "Sem alteração",
  SKIPPED: "Ignorada pelo modo escolhido",
  NEW_FREQUENCY: "Nova frequência",
  CHANGED_FREQUENCY: "Frequência alterada",
  MANUAL_CONFLICT: "Conflito manual",
  FUTURE_VERSION_CONFLICT: "Conflito com versão futura",
};

/** Somente estas classificações geram escrita. */
export const WRITABLE_KINDS: BulkItemKind[] = ["NEW_FREQUENCY", "CHANGED_FREQUENCY"];

// ---------------------------------------------------------------------------
// Schemas (Zod strict — os mesmos no servidor e na UI)
// ---------------------------------------------------------------------------
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use aaaa-mm-dd).");

const freqValue = z
  .number()
  .min(0, "Frequência não pode ser negativa.")
  .max(60, "Frequência acima do limite operacional.")
  .nullable();

/**
 * Seleção declarativa: o navegador manda o CRITÉRIO, não a lista de lojas.
 * O servidor reconstrói a consulta a partir daqui.
 */
export const bulkSelectionSchema = z
  .object({
    scope: z.enum(["ALL_LINKED", "WITHOUT_FREQUENCY", "SEARCH", "SELECTED"]).default("ALL_LINKED"),
    uf: z.string().trim().length(2).nullable().default(null),
    chain: z.string().trim().max(120).nullable().default(null),
    search: z.string().trim().max(80).nullable().default(null),
    /** Só usado com scope = SELECTED; ainda assim revalidado no servidor. */
    storeIds: z.array(z.string().uuid()).max(5000).default([]),
  })
  .strict();

const bulkPreviewBase = z
  .object({
    industryId: z.string().uuid(),
    selection: bulkSelectionSchema,
    weeklyFrequency: freqValue,
    monthlyFrequency: freqValue,
    effectiveDate: isoDate,
    mode: z.enum(["ONLY_WITHOUT", "REPLACE_FROM_DATE", "FUTURE_VERSION", "SELECTED_ONLY"]),
    competenceMonth: z.number().int().min(1).max(12),
    competenceYear: z.number().int().min(2000).max(2100),
  })
  .strict();

const freqRequired = (d: { weeklyFrequency: number | null; monthlyFrequency: number | null }) =>
  d.weeklyFrequency !== null || d.monthlyFrequency !== null;

export const bulkPreviewSchema = bulkPreviewBase.refine(freqRequired, {
  message: "Informe a frequência semanal ou a mensal.",
  path: ["weeklyFrequency"],
});

export const bulkApplySchema = bulkPreviewBase
  .extend({
    reason: z.string().trim().min(3, "Justificativa obrigatória.").max(500),
    confirmRetroactive: z.boolean().default(false),
    /** Sobrescrever conflitos exige decisão explícita, item a item nunca é automático. */
    forceManualConflicts: z.boolean().default(false),
    forceFutureConflicts: z.boolean().default(false),
  })
  .strict()
  .refine(freqRequired, {
    message: "Informe a frequência semanal ou a mensal.",
    path: ["weeklyFrequency"],
  });

export const contractTotalSchema = z
  .object({
    industryId: z.string().uuid(),
    competenceMonth: z.number().int().min(1).max(12),
    competenceYear: z.number().int().min(2000).max(2100),
    contractedTotal: z.number().min(0).max(1000000),
    notes: z.string().trim().max(500).nullable().default(null),
    expectedUpdatedAt: z.string().nullable().default(null),
  })
  .strict();

export const contractSummarySchema = z
  .object({
    industryId: z.string().uuid(),
    competenceMonth: z.number().int().min(1).max(12),
    competenceYear: z.number().int().min(2000).max(2100),
  })
  .strict();

export const acceptDivergenceSchema = z
  .object({
    industryId: z.string().uuid(),
    competenceMonth: z.number().int().min(1).max(12),
    competenceYear: z.number().int().min(2000).max(2100),
    contractedTotal: z.number().min(0),
    distributedTotal: z.number().min(0),
    reason: z.string().trim().min(3, "Justificativa obrigatória.").max(500),
  })
  .strict();

export type BulkPreviewInput = z.infer<typeof bulkPreviewSchema>;
export type BulkApplyInput = z.infer<typeof bulkApplySchema>;

// ---------------------------------------------------------------------------
// Classificação por loja
// ---------------------------------------------------------------------------
export interface BulkStoreState {
  storeId: string;
  storeName: string | null;
  chain: string | null;
  uf: string | null;
  /** Vigência ativa NA data de efeito (null quando a loja não tem frequência). */
  current: {
    id: string;
    weeklyFrequency: number | null;
    monthlyFrequency: number | null;
    validFrom: string;
    validUntil: string | null;
    sourceType: string;
    updatedAt: string;
  } | null;
  /** Existe vigência que começa DEPOIS da data de efeito. */
  hasFutureVersion: boolean;
  /** Loja marcada manualmente na interface (usado no modo SELECTED_ONLY). */
  explicitlySelected?: boolean;
}

export interface BulkPreviewItem extends BulkStoreState {
  kind: BulkItemKind;
  incomingWeekly: number | null;
  incomingMonthly: number | null;
  reason: string | null;
  /** Enviado à RPC apenas quando `kind` for gravável (ou conflito forçado). */
  expectedUpdatedAt: string | null;
}

const same = (a: number | null, b: number | null) => {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 1e-9;
};

export function classifyBulkStore(
  state: BulkStoreState,
  input: {
    weeklyFrequency: number | null;
    monthlyFrequency: number | null;
    mode: BulkApplyMode;
    forceManualConflicts?: boolean;
    forceFutureConflicts?: boolean;
  },
): BulkPreviewItem {
  const base = {
    ...state,
    incomingWeekly: input.weeklyFrequency,
    incomingMonthly: input.monthlyFrequency,
    expectedUpdatedAt: state.current?.updatedAt ?? null,
  };
  const decide = (kind: BulkItemKind, reason: string | null = null): BulkPreviewItem => ({
    ...base,
    kind,
    reason,
  });

  if (input.mode === "SELECTED_ONLY" && state.explicitlySelected === false) {
    return decide("SKIPPED", "Loja não selecionada.");
  }

  if (!state.current) return decide("NEW_FREQUENCY");

  if (input.mode === "ONLY_WITHOUT") {
    return decide("SKIPPED", "Já possui frequência vigente.");
  }

  if (
    same(state.current.weeklyFrequency, input.weeklyFrequency) &&
    same(state.current.monthlyFrequency, input.monthlyFrequency)
  ) {
    return decide("UNCHANGED");
  }

  if (state.hasFutureVersion && !input.forceFutureConflicts) {
    return decide(
      "FUTURE_VERSION_CONFLICT",
      "Existe uma vigência futura para esta loja. Resolva antes de aplicar em lote.",
    );
  }

  if (state.current.sourceType === "MANUAL" && !input.forceManualConflicts) {
    return decide(
      "MANUAL_CONFLICT",
      "A frequência vigente foi definida manualmente. Confirme para sobrescrever.",
    );
  }

  return decide("CHANGED_FREQUENCY");
}

export interface BulkPreviewCounters {
  selected: number;
  unchanged: number;
  skipped: number;
  new: number;
  changed: number;
  manualConflicts: number;
  futureConflicts: number;
  writable: number;
}

export function countBulkPreview(items: BulkPreviewItem[]): BulkPreviewCounters {
  const c: BulkPreviewCounters = {
    selected: items.length,
    unchanged: 0,
    skipped: 0,
    new: 0,
    changed: 0,
    manualConflicts: 0,
    futureConflicts: 0,
    writable: 0,
  };
  for (const i of items) {
    if (i.kind === "UNCHANGED") c.unchanged++;
    else if (i.kind === "SKIPPED") c.skipped++;
    else if (i.kind === "NEW_FREQUENCY") c.new++;
    else if (i.kind === "CHANGED_FREQUENCY") c.changed++;
    else if (i.kind === "MANUAL_CONFLICT") c.manualConflicts++;
    else if (i.kind === "FUTURE_VERSION_CONFLICT") c.futureConflicts++;
    if (WRITABLE_KINDS.includes(i.kind)) c.writable++;
  }
  return c;
}

/** Payload mínimo enviado à RPC transacional. Só itens graváveis. */
export function bulkRpcItems(
  items: BulkPreviewItem[],
  effectiveDate: string,
): Array<{
  store_id: string;
  weekly: number | null;
  monthly: number | null;
  effective_date: string;
  expected_updated_at: string | null;
}> {
  return items
    .filter((i) => WRITABLE_KINDS.includes(i.kind))
    .map((i) => ({
      store_id: i.storeId,
      weekly: i.incomingWeekly,
      monthly: i.incomingMonthly,
      effective_date: effectiveDate,
      expected_updated_at: i.expectedUpdatedAt,
    }));
}

// ---------------------------------------------------------------------------
// Distribuição: total por loja usando o motor oficial
// ---------------------------------------------------------------------------
export interface StoreDistributionInput {
  storeId: string;
  storeName?: string | null;
  chain?: string | null;
  uf?: string | null;
  segments: FrequencySegmentInput[];
}

export interface StoreDistribution {
  storeId: string;
  storeName: string | null;
  chain: string | null;
  uf: string | null;
  contratadas: number;
  /** rótulo de agrupamento: "4x/mês", "0,5x/sem", "sem frequência" */
  label: string;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

/** Rótulo do grupo — usa a vigência dominante (a de maior duração no período). */
export function distributionLabel(segments: FrequencySegmentInput[]): string {
  if (!segments.length) return "sem frequência";
  const s = segments[segments.length - 1];
  if (s.monthlyFrequency != null && s.monthlyFrequency > 0)
    return `${fmt(s.monthlyFrequency)}x/mês`;
  if (s.weeklyFrequency != null && s.weeklyFrequency > 0) return `${fmt(s.weeklyFrequency)}x/sem`;
  return "sem frequência";
}

export function computeStoreDistribution(
  stores: StoreDistributionInput[],
  period: { start: string; end: string },
): StoreDistribution[] {
  return stores.map((s) => {
    const result = contractedVisitsForFrequencySegments({
      segments: s.segments,
      operationPeriodStart: period.start,
      operationPeriodEnd: period.end,
    });
    return {
      storeId: s.storeId,
      storeName: s.storeName ?? null,
      chain: s.chain ?? null,
      uf: s.uf ?? null,
      contratadas: result.contratadas,
      label: distributionLabel(s.segments),
    };
  });
}

export interface FrequencyGroup {
  label: string;
  stores: number;
  visits: number;
}

/** Agrupamento "4 visitas/mês — 120 lojas — 480 visitas". */
export function groupDistribution(rows: StoreDistribution[]): FrequencyGroup[] {
  const map = new Map<string, FrequencyGroup>();
  for (const r of rows) {
    const g = map.get(r.label) ?? { label: r.label, stores: 0, visits: 0 };
    g.stores += 1;
    g.visits += r.contratadas;
    map.set(r.label, g);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.visits - a.visits || a.label.localeCompare(b.label),
  );
}

// ---------------------------------------------------------------------------
// Conferência contrato × distribuição
// ---------------------------------------------------------------------------
export type ContractCheckStatus =
  | "CONFERIDO"
  | "ABAIXO_DO_CONTRATO"
  | "ACIMA_DO_CONTRATO"
  | "SEM_TOTAL_INFORMADO";

export const CONTRACT_STATUS_LABEL: Record<ContractCheckStatus, string> = {
  CONFERIDO: "Conferido",
  ABAIXO_DO_CONTRATO: "Abaixo do contrato",
  ACIMA_DO_CONTRATO: "Acima do contrato",
  SEM_TOTAL_INFORMADO: "Sem total informado",
};

export interface ContractCheck {
  contractedTotal: number | null;
  distributedTotal: number;
  difference: number | null;
  differencePercentage: number | null;
  storesWithFrequency: number;
  storesWithoutFrequency: number;
  status: ContractCheckStatus;
  message: string | null;
}

/** Diferença relativa (em %) a partir da qual a divergência é considerada relevante. */
export const CONTRACT_DIVERGENCE_CRITICAL_PCT = 5;

export function evaluateContract(input: {
  contractedTotal: number | null;
  rows: StoreDistribution[];
}): ContractCheck {
  const distributedTotal = input.rows.reduce((acc, r) => acc + r.contratadas, 0);
  const storesWithFrequency = input.rows.filter((r) => r.label !== "sem frequência").length;
  const storesWithoutFrequency = input.rows.length - storesWithFrequency;

  if (input.contractedTotal === null || input.contractedTotal === undefined) {
    return {
      contractedTotal: null,
      distributedTotal,
      difference: null,
      differencePercentage: null,
      storesWithFrequency,
      storesWithoutFrequency,
      status: "SEM_TOTAL_INFORMADO",
      message: null,
    };
  }

  const difference = distributedTotal - input.contractedTotal;
  const pct =
    input.contractedTotal > 0
      ? Math.round((difference / input.contractedTotal) * 10000) / 100
      : difference === 0
        ? 0
        : 100;

  const status: ContractCheckStatus =
    difference === 0 ? "CONFERIDO" : difference < 0 ? "ABAIXO_DO_CONTRATO" : "ACIMA_DO_CONTRATO";

  return {
    contractedTotal: input.contractedTotal,
    distributedTotal,
    difference,
    differencePercentage: pct,
    storesWithFrequency,
    storesWithoutFrequency,
    status,
    message:
      difference === 0
        ? null
        : `Há uma diferença de ${Math.abs(difference)} visita(s) entre o contrato informado e a soma das frequências por loja.`,
  };
}

/** Severidade sugerida ao Centro de Qualidade. */
export function divergenceSeverity(check: ContractCheck): "ATENCAO" | "CRITICO" {
  const pct = Math.abs(check.differencePercentage ?? 0);
  return pct >= CONTRACT_DIVERGENCE_CRITICAL_PCT ? "CRITICO" : "ATENCAO";
}

// ---------------------------------------------------------------------------
// Erros da RPC → mensagens seguras
// ---------------------------------------------------------------------------
export const BULK_ERROR_MESSAGES: Record<string, string> = {
  MK9_FREQUENCY_BULK_INVALID_PAYLOAD: "Seleção inválida. Refaça a prévia e tente novamente.",
  MK9_FREQUENCY_BULK_TOO_LARGE: "Seleção acima do limite permitido em uma única aplicação.",
  MK9_CONTRACT_TOTAL_CONCURRENT_MODIFICATION:
    "O total contratado foi alterado por outra pessoa. Recarregue e tente novamente.",
  MK9_CONTRACT_TOTAL_INVALID: "Total contratado inválido.",
};
