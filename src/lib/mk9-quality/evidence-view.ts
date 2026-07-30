/**
 * MK9 — Fase 2B.3: projeção da evidência para leitura humana.
 *
 * Módulo PURO. Regras:
 *  - o usuário comum NUNCA vê JSON cru;
 *  - cada detector tem um renderizador próprio (lista de campos rotulados);
 *  - campos técnicos (arquivo, fonte, fingerprint, ids internos) só aparecem
 *    na seção técnica recolhida e apenas para papéis administrativos;
 *  - a evidência que chega aqui JÁ foi sanitizada no servidor; esta camada é
 *    a segunda barreira, decidindo o que faz sentido mostrar.
 */
import type { Mk9Evidence, Mk9JsonValue, Mk9QualityIssueView } from "./types";
import { competenceLabel, symptomLabel } from "./labels";
import type { Mk9QualityModule } from "./navigation";

export interface EvidenceRow {
  label: string;
  value: string;
  /** Realce visual para números que explicam a gravidade. */
  emphasis?: boolean;
}

const BOOL = (v: Mk9JsonValue | undefined) => (v === true ? "Sim" : v === false ? "Não" : "—");
const TEXT = (v: Mk9JsonValue | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v);
const NUM = (v: Mk9JsonValue | undefined) =>
  typeof v === "number" ? String(v) : v === null || v === undefined ? "—" : String(v);

function symptomList(v: Mk9JsonValue | undefined): string {
  if (!Array.isArray(v) || !v.length) return "—";
  return v.map((s) => symptomLabel(String(s))).join(" · ");
}

/** Chaves que nunca são exibidas nem na seção técnica. */
const NEVER_SHOW = new Set([
  "navigationTarget", "fingerprint", "contextHash", "filename", "fileName",
  "source", "errorCode",
]);

/**
 * Renderizadores por tipo de problema (item 10 da missão).
 * A chave é o `issueType`; o fallback cobre detectores futuros.
 */
const RENDERERS: Record<string, (e: Mk9Evidence) => EvidenceRow[]> = {
  PROBABLE_STORE_DUPLICATE: (e) => [
    { label: "Loja A", value: TEXT(e.storeName), emphasis: true },
    { label: "Loja B", value: TEXT(e.peerStoreName), emphasis: true },
    { label: "UF", value: TEXT(e.storeUf) },
    { label: "Cidade", value: TEXT(e.city) },
    { label: "Rede", value: TEXT(e.chain) },
    {
      label: "Similaridade",
      value: typeof e.similarity === "number" ? `${Math.round(e.similarity * 100)}%` : "—",
      emphasis: true,
    },
    { label: "Motivo da suspeita", value: TEXT(e.reason ?? "Nomes equivalentes na mesma UF e rede") },
  ],

  FREQUENCY_WEEKLY_MONTHLY_INCONSISTENCY: (e) => [
    { label: "Loja", value: TEXT(e.storeName), emphasis: true },
    { label: "Indústria", value: TEXT(e.industryName) },
    { label: "UF", value: TEXT(e.storeUf) },
    { label: "Frequência semanal", value: NUM(e.weeklyFrequency), emphasis: true },
    { label: "Frequência mensal", value: NUM(e.monthlyFrequency), emphasis: true },
    { label: "Mensal esperado pela regra comercial", value: NUM(e.expectedMonthly) },
    { label: "Diferença", value: NUM(e.difference), emphasis: true },
    { label: "Vigência a partir de", value: TEXT(e.validFrom) },
    { label: "Vigência até", value: TEXT(e.validUntil ?? "Sem término") },
    { label: "Origem do cadastro", value: TEXT(e.sourceType) },
  ],

  OPERATION_PAIR_INTEGRITY: (e) => [
    { label: "Possui frequência vigente?", value: BOOL(e.hasFrequency) },
    { label: "Possui roteiro vigente?", value: BOOL(e.hasRoute) },
    { label: "Visitas contratadas", value: NUM(e.contractedVisits) },
    { label: "Visitas realizadas", value: NUM(e.executedVisits), emphasis: true },
    { label: "Visitas sem roteiro", value: NUM(e.visitsWithoutRoute), emphasis: true },
    { label: "Roteiros candidatos", value: NUM(e.routeCandidateCount) },
    { label: "Promotor vigente", value: TEXT(e.promoterName) },
    { label: "Sintomas", value: symptomList(e.symptoms) },
  ],

  EXCEL_DATABASE_DIVERGENCE: (e) => [
    { label: "Total declarado na planilha", value: NUM(e.declared ?? e.expected) },
    { label: "Total interpretado na leitura", value: NUM(e.parsed ?? e.found) },
    { label: "Total persistido no banco", value: NUM(e.persisted ?? e.actual), emphasis: true },
    { label: "Diferença", value: NUM(e.delta ?? e.difference), emphasis: true },
    { label: "Competência", value: TEXT(e.competence) },
  ],

  PENDING_IMPORT_CONFLICT: (e) => [
    { label: "Tipo de conflito", value: TEXT(e.conflictKind ?? e.symptom), emphasis: true },
    { label: "Quantidade", value: NUM(e.count) },
    { label: "Competência", value: TEXT(e.competence) },
    { label: "Parada há", value: TEXT(e.stalledForMinutes ? `${e.stalledForMinutes} min` : null) },
    { label: "Decisão necessária", value: TEXT(e.decision ?? "Reprocessar ou descartar a importação") },
  ],

  INDUSTRY_WITHOUT_PERIOD_CONFIG: (e) => [
    { label: "Indústria", value: TEXT(e.industryName), emphasis: true },
    { label: "Período usado atualmente", value: TEXT(e.currentPeriod ?? e.competence) },
    { label: "Usando mês civil como alternativa", value: BOOL(e.usingCalendarFallback ?? true) },
  ],

  CHECKLIST_IMPORT_WITHOUT_VALIDATION: (e) => [
    { label: "Indústria", value: TEXT(e.industryName), emphasis: true },
    { label: "Competência", value: TEXT(e.competence) },
    { label: "Importado em", value: TEXT(e.importedAt) },
    { label: "Status atual", value: TEXT(e.importStatus ?? e.validationStatus) },
  ],

  INCOMPLETE_STORE_WITH_EXECUTION: (e) => [
    { label: "Loja", value: TEXT(e.storeName), emphasis: true },
    {
      label: "Campos ausentes",
      value: Array.isArray(e.missing) && e.missing.length ? e.missing.join(", ") : "—",
      emphasis: true,
    },
    { label: "Visitas afetadas no período", value: NUM(e.executedVisits) },
    { label: "Vigências de frequência", value: NUM(e.frequencyVersions) },
    { label: "Roteiros vinculados", value: NUM(e.routeCandidateCount) },
    { label: "Rede", value: TEXT(e.chain) },
    { label: "UF", value: TEXT(e.storeUf) },
  ],
};

/** Fallback legível: pares chave/valor simples, sem estrutura aninhada crua. */
function fallbackRows(evidence: Mk9Evidence): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  for (const [key, value] of Object.entries(evidence ?? {})) {
    if (NEVER_SHOW.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (!value.length || typeof value[0] === "object") continue;
      rows.push({ label: humanKey(key), value: value.map(String).join(", ") });
      continue;
    }
    if (typeof value === "object") continue;
    rows.push({ label: humanKey(key), value: String(value) });
  }
  return rows;
}

const KEY_LABEL: Record<string, string> = {
  storeName: "Loja",
  storeUf: "UF",
  industryName: "Indústria",
  chain: "Rede",
  count: "Quantidade",
  hidden: "Não listadas",
  competence: "Competência",
  expected: "Esperado",
  found: "Encontrado",
  executedVisits: "Visitas realizadas",
  contractedVisits: "Visitas contratadas",
  pendingVisits: "Visitas pendentes",
  visitsWithoutRoute: "Visitas sem roteiro",
  routeCandidateCount: "Roteiros vinculados",
  frequencyVersions: "Vigências de frequência",
  similarity: "Similaridade",
  missing: "Campos ausentes",
  peerStoreName: "Loja comparada",
  weeklyFrequency: "Frequência semanal",
  monthlyFrequency: "Frequência mensal",
  expectedMonthly: "Mensal esperado",
  difference: "Diferença",
  validFrom: "Vigência a partir de",
  validUntil: "Vigência até",
  sourceType: "Origem do cadastro",
};

function humanKey(key: string): string {
  if (KEY_LABEL[key]) return KEY_LABEL[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Linhas da evidência prontas para exibição (sem valores vazios). */
export function evidenceRows(issueType: string, evidence: Mk9Evidence): EvidenceRow[] {
  const renderer = RENDERERS[issueType];
  const rows = renderer ? renderer(evidence ?? {}) : fallbackRows(evidence ?? {});
  return rows.filter((r) => r.value !== "—" && r.value !== "");
}

/** Sintomas da ocorrência composta (item 11). */
export function issueSymptoms(evidence: Mk9Evidence): string[] {
  const raw = evidence?.symptoms;
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => symptomLabel(String(s)));
}

/**
 * Seção técnica (recolhida, apenas ADMIN/AUDITOR). Continua sanitizada:
 * chaves proibidas nunca aparecem e nada de JSON cru com payload.
 */
export function technicalRows(issue: Mk9QualityIssueView): EvidenceRow[] {
  const rows: EvidenceRow[] = [
    { label: "Tipo técnico", value: issue.issueType },
    { label: "Categoria", value: issue.category },
    { label: "Entidade", value: issue.entityType },
    { label: "Competência", value: competenceLabel(issue.competenceMonth, issue.competenceYear) },
  ];
  if (issue.source) rows.push({ label: "Detector", value: issue.source });
  if (issue.fingerprint) {
    rows.push({ label: "Impressão digital", value: `${issue.fingerprint.slice(0, 12)}…` });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Deep-link seguro (item 12)
// ---------------------------------------------------------------------------

const ALLOWED_MODULES: Mk9QualityModule[] = [
  "stores", "routes", "frequency", "audit", "imports", "checklists", "industries",
];

/** Módulo padrão por categoria, quando a evidência não traz destino confiável. */
const CATEGORY_MODULE: Record<string, Mk9QualityModule> = {
  CADASTRO: "stores",
  FREQUENCIA: "frequency",
  ROTEIRO: "routes",
  VISITA: "audit",
  IMPORTACAO: "imports",
  INTEGRIDADE: "audit",
  SEGURANCA: "audit",
};

export interface ResolvedNavigation {
  module: Mk9QualityModule;
  industryId: string | null;
  storeId: string | null;
  month: number | null;
  year: number | null;
}

/**
 * Resolve o destino de navegação SEM confiar na evidência.
 *
 * Da evidência aproveitamos apenas o nome do módulo, e mesmo assim contra uma
 * lista fechada. Todos os identificadores vêm das colunas da própria
 * ocorrência, que já passaram pelo filtro de escopo do servidor. Assim uma
 * evidência adulterada não consegue apontar para dado de terceiros.
 */
export function resolveIssueNavigation(issue: Mk9QualityIssueView): ResolvedNavigation {
  const raw = issue.evidence?.navigationTarget as Record<string, Mk9JsonValue> | undefined;
  const requested = typeof raw?.module === "string" ? (raw.module as Mk9QualityModule) : null;
  const module =
    requested && ALLOWED_MODULES.includes(requested)
      ? requested
      : (CATEGORY_MODULE[issue.category] ?? "audit");

  return {
    module,
    industryId: issue.industryId,
    storeId: issue.storeId,
    month: issue.competenceMonth,
    year: issue.competenceYear,
  };
}

export const NAVIGATION_LABEL: Record<Mk9QualityModule, string> = {
  stores: "Abrir cadastro da loja",
  routes: "Abrir Roteiros",
  frequency: "Abrir Frequência",
  audit: "Abrir Auditoria",
  imports: "Abrir Importações",
  checklists: "Abrir Checklists",
  industries: "Abrir Indústrias",
};
