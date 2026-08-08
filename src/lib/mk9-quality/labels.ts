/**
 * MK9 — Fase 2B.3: vocabulário e regras puras da interface do Centro de
 * Qualidade dos Dados.
 *
 * Módulo PURO (sem React, sem Supabase): tudo aqui é testável e reutilizável
 * pela interface, pelos testes e por qualquer relatório futuro.
 *
 * Princípios de apresentação fixados nesta fase:
 *  - nunca misturar unidades (ocorrência ≠ loja ≠ visita ≠ sintoma);
 *  - severidade nunca depende só de cor (sempre texto + descrição);
 *  - status técnico permanece no enum; o usuário lê português.
 */
import type {
  Mk9QualityCategory,
  Mk9QualityIssueView,
  Mk9QualitySeverity,
  Mk9QualityStatus,
} from "./types";
import type { Mk9ManualTransition } from "./lifecycle";

// ---------------------------------------------------------------------------
// Severidade
// ---------------------------------------------------------------------------

export interface SeverityMeta {
  label: string;
  weight: number;
  /** Explicação usada em tooltip — a cor nunca é o único sinal. */
  hint: string;
  /** Classe utilitária do badge (tokens semânticos do design system). */
  className: string;
  dotClassName: string;
}

export const SEVERITY_META: Record<Mk9QualitySeverity, SeverityMeta> = {
  BLOQUEANTE: {
    label: "Bloqueante",
    weight: 5,
    hint: "Impede importação segura ou gera divergência de dados. Resolver antes de fechar o período.",
    className: "border-destructive/50 bg-destructive/15 text-destructive",
    dotClassName: "bg-destructive",
  },
  CRITICO: {
    label: "Crítico",
    weight: 4,
    hint: "Afeta diretamente o número do período (contratado, executado ou recorte regional).",
    className: "border-destructive/35 bg-destructive/10 text-destructive",
    dotClassName: "bg-destructive/70",
  },
  ATENCAO: {
    label: "Atenção",
    weight: 3,
    hint: "Inconsistência operacional comum: precisa de revisão, mas não invalida o período.",
    className:
      "border-[color:var(--color-kpi-amber)]/40 bg-[color-mix(in_oklab,var(--color-kpi-amber)_16%,transparent)] text-[color:var(--color-kpi-amber)]",
    dotClassName: "bg-[color:var(--color-kpi-amber)]",
  },
  AVISO: {
    label: "Aviso",
    weight: 2,
    hint: "Desvio pequeno ou sinal preventivo. Acompanhar.",
    className:
      "border-[color:var(--color-kpi-amber)]/25 bg-[color-mix(in_oklab,var(--color-kpi-amber)_9%,transparent)] text-[color:var(--color-kpi-amber)]",
    dotClassName: "bg-[color:var(--color-kpi-amber)]/60",
  },
  INFO: {
    label: "Informativo",
    weight: 1,
    hint: "Apenas contexto. Nenhuma ação obrigatória.",
    className: "border-border bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground/60",
  },
};

export const SEVERITY_ORDER: Mk9QualitySeverity[] = [
  "BLOQUEANTE",
  "CRITICO",
  "ATENCAO",
  "AVISO",
  "INFO",
];

export function severityWeight(severity: string): number {
  return SEVERITY_META[severity as Mk9QualitySeverity]?.weight ?? 0;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export interface StatusMeta {
  label: string;
  hint: string;
  className: string;
  /** Status que ainda pedem ação humana. */
  open: boolean;
}

export const STATUS_META: Record<Mk9QualityStatus, StatusMeta> = {
  OPEN: {
    label: "Aberto",
    open: true,
    hint: "Detectado e ainda sem tratativa.",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  ACKNOWLEDGED: {
    label: "Reconhecido",
    open: true,
    hint: "Alguém confirmou que viu o problema.",
    className: "border-border bg-muted text-foreground",
  },
  IN_PROGRESS: {
    label: "Em andamento",
    open: true,
    hint: "Correção em execução no módulo de origem.",
    className: "border-primary/35 bg-primary/10 text-primary",
  },
  RESOLVED: {
    label: "Resolvido",
    open: false,
    hint: "Resolvido manualmente, com nota de resolução.",
    className:
      "border-[color:var(--color-kpi-green)]/35 bg-[color-mix(in_oklab,var(--color-kpi-green)_14%,transparent)] text-[color:var(--color-kpi-green)]",
  },
  RESOLVED_AUTO: {
    label: "Resolvido automaticamente",
    open: false,
    hint: "O detector deixou de encontrar o problema na última execução.",
    className:
      "border-[color:var(--color-kpi-green)]/25 bg-[color-mix(in_oklab,var(--color-kpi-green)_9%,transparent)] text-[color:var(--color-kpi-green)]",
  },
  IGNORED: {
    label: "Ignorado",
    open: false,
    hint: "Decisão registrada de não tratar. Só reabre se o contexto mudar.",
    className: "border-border bg-muted text-muted-foreground",
  },
  REOPENED: {
    label: "Reaberto",
    open: true,
    hint: "O problema voltou depois de resolvido ou o contexto mudou.",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export const OPEN_STATUSES: Mk9QualityStatus[] = (
  Object.keys(STATUS_META) as Mk9QualityStatus[]
).filter((s) => STATUS_META[s].open);

// ---------------------------------------------------------------------------
// Categoria
// ---------------------------------------------------------------------------

export const CATEGORY_LABEL: Record<Mk9QualityCategory, string> = {
  CADASTRO: "Cadastro",
  FREQUENCIA: "Frequência",
  ROTEIRO: "Roteiro",
  VISITA: "Visita",
  IMPORTACAO: "Importação",
  INTEGRIDADE: "Integridade",
  SEGURANCA: "Segurança",
};

export const CATEGORY_ORDER: Mk9QualityCategory[] = [
  "CADASTRO",
  "FREQUENCIA",
  "ROTEIRO",
  "VISITA",
  "IMPORTACAO",
  "INTEGRIDADE",
  "SEGURANCA",
];

// ---------------------------------------------------------------------------
// Tipos de problema (rótulo amigável por detector)
// ---------------------------------------------------------------------------

export const ISSUE_TYPE_LABEL: Record<string, string> = {
  PROBABLE_STORE_DUPLICATE: "Possível loja duplicada",
  PROBABLE_STORE_DUPLICATE_SUMMARY: "Muitas lojas possivelmente duplicadas",
  INCOMPLETE_STORE_WITH_EXECUTION: "Cadastro de loja incompleto em operação",
  INCOMPLETE_STORE_WITH_EXECUTION_SUMMARY: "Muitos cadastros incompletos em operação",
  OPERATION_PAIR_INTEGRITY: "Par indústria × loja incompleto",
  OPERATION_PAIR_INTEGRITY_SUMMARY: "Muitos pares indústria × loja incompletos",
  EXCEL_DATABASE_DIVERGENCE: "Planilha divergente do banco",
  PENDING_IMPORT_CONFLICT: "Importação travada ou com falha",
  INDUSTRY_WITHOUT_PERIOD_CONFIG: "Indústria sem período configurado",
  CHECKLIST_IMPORT_WITHOUT_VALIDATION: "Checklist importado sem validação",
  FREQUENCY_WEEKLY_MONTHLY_INCONSISTENCY: "Frequência semanal e mensal divergentes",
  FREQUENCY_WEEKLY_MONTHLY_INCONSISTENCY_SUMMARY:
    "Muitas frequências semanais e mensais divergentes",
  PROJECTION_FREQUENCY_DIVERGENCE: "Projeção de frequência divergente",
  FREQUENCY_OVERLAP_GUARD_STATUS: "Proteção de vigência de frequência",
  LEGACY_OPERATIONAL_DATA: "Dado operacional legado",
};

export function issueTypeLabel(issueType: string): string {
  return ISSUE_TYPE_LABEL[issueType] ?? issueType.replaceAll("_", " ").toLowerCase();
}

// ---------------------------------------------------------------------------
// Sintomas do par indústria × loja (ocorrência composta)
// ---------------------------------------------------------------------------

export const SYMPTOM_LABEL: Record<string, string> = {
  NO_FREQUENCY: "Sem frequência contratada vigente",
  ZERO_FREQUENCY: "Frequência vigente resulta em zero visitas no período",
  NO_ROUTE: "Nenhum roteiro vigente",
  VISITS_WITHOUT_ROUTE: "Visitas realizadas sem roteiro correspondente",
  ROUTE_WITHOUT_FREQUENCY: "Roteiro vigente sem frequência contratada",
};

export function symptomLabel(symptom: string): string {
  return SYMPTOM_LABEL[symptom] ?? symptom.replaceAll("_", " ").toLowerCase();
}

// ---------------------------------------------------------------------------
// Ordenação da lista
// ---------------------------------------------------------------------------

/** Gravidade primeiro; empate resolve pela detecção mais recente. */
export function compareIssues(a: Mk9QualityIssueView, b: Mk9QualityIssueView): number {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    String(b.lastSeenAt).localeCompare(String(a.lastSeenAt))
  );
}

export function sortIssues(items: Mk9QualityIssueView[]): Mk9QualityIssueView[] {
  return [...items].sort(compareIssues);
}

// ---------------------------------------------------------------------------
// Papéis e ações
// ---------------------------------------------------------------------------

export type Mk9QualityRole = "ADMIN" | "DEV" | "AUDITOR" | "SUPERVISOR" | "CLIENTE" | "PROMOTOR";

/** PROMOTOR não enxerga o Centro de Qualidade nesta fase. */
export const QUALITY_MODULE_ROLES: Mk9QualityRole[] = [
  "ADMIN",
  "DEV",
  "AUDITOR",
  "SUPERVISOR",
  "CLIENTE",
];

export function canOpenQualityModule(roles: string[]): boolean {
  return roles.some((r) => (QUALITY_MODULE_ROLES as string[]).includes(r));
}

/** Papéis que podem disparar um ciclo persistente de detecção. */
export function canRunPersistentCycle(role: string, canViewAll: boolean): boolean {
  return (role === "ADMIN" || role === "DEV" || role === "AUDITOR") && canViewAll;
}

export interface TransitionOption {
  target: Mk9ManualTransition;
  label: string;
  /** Nota obrigatória? (espelha `requiresReason` do ciclo de vida) */
  reasonRequired: boolean;
  danger?: boolean;
  warning?: string;
}

const ALL_TRANSITIONS: TransitionOption[] = [
  { target: "ACKNOWLEDGED", label: "Reconhecer", reasonRequired: false },
  { target: "IN_PROGRESS", label: "Marcar em andamento", reasonRequired: false },
  { target: "RESOLVED", label: "Resolver", reasonRequired: true },
  {
    target: "IGNORED",
    label: "Ignorar",
    reasonRequired: true,
    danger: true,
    warning:
      "A ocorrência deixa de ser cobrada e NÃO será reaberta enquanto o contexto do problema permanecer o mesmo.",
  },
];

/**
 * Ações disponíveis na interface. O servidor revalida tudo — isto apenas
 * evita oferecer o que seria recusado.
 *
 * - REALTIME não tem histórico: não aceita ação de status;
 * - IGNORAR é decisão de risco: ADMIN/DEV/AUDITOR (mesma regra do servidor);
 * - CLIENTE e PROMOTOR são somente leitura;
 * - status finais não recebem novas transições manuais.
 */
export function availableTransitions(params: {
  role: string;
  status: Mk9QualityStatus;
  persisted: boolean;
}): TransitionOption[] {
  if (!params.persisted) return [];
  if (params.role === "CLIENTE" || params.role === "PROMOTOR") return [];
  if (
    params.status === "RESOLVED" ||
    params.status === "RESOLVED_AUTO" ||
    params.status === "IGNORED"
  ) {
    return [];
  }
  return ALL_TRANSITIONS.filter((t) => {
    if (t.target === "IGNORED") {
      return params.role === "ADMIN" || params.role === "DEV" || params.role === "AUDITOR";
    }

    if (t.target === "ACKNOWLEDGED")
      return params.status === "OPEN" || params.status === "REOPENED";
    if (t.target === "IN_PROGRESS") return params.status !== "IN_PROGRESS";
    return true;
  });
}

// ---------------------------------------------------------------------------
// Unidades — nunca misturar ocorrência com loja/visita/sintoma
// ---------------------------------------------------------------------------

export type Mk9QualityUnit =
  | "ocorrencia"
  | "loja"
  | "visita"
  | "sintoma"
  | "par"
  | "importacao"
  | "industria";

const UNIT_WORD: Record<Mk9QualityUnit, [string, string]> = {
  ocorrencia: ["ocorrência", "ocorrências"],
  loja: ["loja", "lojas"],
  visita: ["visita", "visitas"],
  sintoma: ["sintoma", "sintomas"],
  par: ["par indústria × loja", "pares indústria × loja"],
  importacao: ["importação", "importações"],
  industria: ["indústria", "indústrias"],
};

export function countLabel(value: number, unit: Mk9QualityUnit): string {
  const [one, many] = UNIT_WORD[unit];
  return `${value} ${value === 1 ? one : many}`;
}

/**
 * Item 0.B — leitura correta das "lojas incompletas".
 *
 * São quatro números diferentes e a interface precisa dizer qual está usando:
 *  - `issues`  → ocorrências abertas do detector (uma por loja detectada, mais
 *                a ocorrência-resumo quando o volume estoura o teto);
 *  - `stores`  → lojas DISTINTAS por trás dessas ocorrências;
 *  - `visits`  → visitas do período afetadas por essas lojas;
 *  - `flagged` → lojas com `is_incomplete = true` no cadastro, que é um
 *                conjunto MAIOR: inclui lojas sem operação, que não viram
 *                ocorrência.
 */
export function describeIncompleteStores(input: {
  issues: number;
  stores: number;
  visits: number;
}): string {
  if (input.issues === 0) return "Nenhum cadastro incompleto em operação";
  return `${countLabel(input.issues, "ocorrencia")} em cadastros incompletos — ${countLabel(
    input.stores,
    "loja",
  )} com ${countLabel(input.visits, "visita")} no período`;
}

/** "X ocorrências consolidadas a partir de Y sintomas." (item 18) */
export function describeConsolidation(issues: number, symptoms: number): string {
  return `${countLabel(issues, "ocorrencia")} consolidadas a partir de ${countLabel(symptoms, "sintoma")}.`;
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function competenceLabel(month: number | null, year: number | null): string {
  if (!month || !year) return "Sem competência";
  return `${MONTHS_PT[month - 1] ?? month}/${year}`;
}

export function dateTimeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

export function relativeLabel(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const minutes = Math.round((now.getTime() - d.getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} d`;
}

// ---------------------------------------------------------------------------
// Eventos da linha do tempo
// ---------------------------------------------------------------------------

export const EVENT_LABEL: Record<string, string> = {
  DETECTED: "Detectado",
  SEEN_AGAIN: "Visto novamente",
  ACKNOWLEDGED: "Reconhecido",
  STARTED: "Tratativa iniciada",
  RESOLVED: "Resolvido",
  RESOLVED_AUTO: "Resolvido automaticamente",
  IGNORED: "Ignorado",
  REOPENED: "Reaberto",
  EVIDENCE_UPDATED: "Evidência atualizada",
};

export function eventLabel(eventType: string): string {
  return EVENT_LABEL[eventType] ?? "Atualização";
}
