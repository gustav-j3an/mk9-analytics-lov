/**
 * MK9 — Fase 2B.3: interface operacional do Centro de Qualidade dos Dados.
 *
 * A tela NÃO corrige nada: ela consolida, explica e leva o usuário até o
 * módulo de origem do problema. Toda decisão de permissão é revalidada no
 * servidor; aqui só evitamos oferecer o que seria recusado.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  Filter,
  History,
  Info,
  Loader2,
  OctagonAlert,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useMk9Session } from "@/lib/mk9-auth/session";
import {
  mk9QualityAddCommentFn,
  mk9QualityArchiveCommentFn,
  mk9QualityAssignFn,
  mk9QualityDetailFn,
  mk9QualityEditCommentFn,
  mk9QualityFacetsFn,
  mk9QualityFollowUpFn,
  mk9QualityListFn,
  mk9QualityOverviewFn,
  mk9QualityPlanningFn,
  mk9QualityReopenFn,
  mk9QualityRunFn,
  mk9QualityTransitionFn,
} from "@/lib/mk9-quality.functions";
import {
  AssigneeBadge,
  AssignmentSection,
  CommentsSection,
  DueBadge,
  FollowUpPanel,
  PriorityBadge,
  TreatmentSection,
} from "@/components/mk9/quality-follow-up";

import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  MONTHS_PT,
  SEVERITY_META,
  SEVERITY_ORDER,
  STATUS_META,
  availableTransitions,
  competenceLabel,
  countLabel,
  dateTimeLabel,
  describeConsolidation,
  describeIncompleteStores,
  eventLabel,
  issueTypeLabel,
  relativeLabel,
  sortIssues,
} from "@/lib/mk9-quality/labels";
import {
  NAVIGATION_LABEL,
  evidenceRows,
  issueSymptoms,
  resolveIssueNavigation,
  technicalRows,
  type ResolvedNavigation,
} from "@/lib/mk9-quality/evidence-view";
import type {
  Mk9QualityCategory,
  Mk9QualityIssueView,
  Mk9QualitySeverity,
  Mk9QualityStatus,
} from "@/lib/mk9-quality/types";
import type { Mk9ManualTransition } from "@/lib/mk9-quality/lifecycle";

const PAGE_SIZE = 25;
const ALL = "__ALL__";

export interface Mk9QualityModuleProps {
  month: number;
  year: number;
  onNavigate?: (target: ResolvedNavigation) => void;
}

interface Filters {
  search: string;
  category: string;
  issueType: string;
  severity: string;
  status: string;
  industryId: string;
  uf: string;
  assignedTo: string | null;
  dueState: string | null;
  month: number;
  year: number;
  page: number;
}

type ListMode = "PERSISTED" | "REALTIME";

const STATUS_PRESETS: Record<string, Mk9QualityStatus[] | null> = {
  __OPEN__: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"],
  __ALL__: null,
};

function statusesFor(value: string): Mk9QualityStatus[] | null {
  if (STATUS_PRESETS[value] !== undefined) return STATUS_PRESETS[value];
  return [value as Mk9QualityStatus];
}

function SeverityIcon({ severity, className }: { severity: Mk9QualitySeverity; className?: string }) {
  const Icon =
    severity === "BLOQUEANTE"
      ? OctagonAlert
      : severity === "CRITICO"
        ? CircleAlert
        : severity === "ATENCAO" || severity === "AVISO"
          ? TriangleAlert
          : Info;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden />;
}

function SeverityBadge({ severity }: { severity: Mk9QualitySeverity }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.INFO;
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        meta.className,
      )}
    >
      <SeverityIcon severity={severity} />
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: Mk9QualityStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.OPEN;
  return (
    <span
      title={meta.hint}
      className={cn("inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium", meta.className)}
    >
      {meta.label}
    </span>
  );
}

export function Mk9QualityModule({ month, year, onNavigate }: Mk9QualityModuleProps) {
  const queryClient = useQueryClient();
  const { roles } = useMk9Session();
  const role = roles.includes("ADMIN")
    ? "ADMIN"
    : roles.includes("AUDITOR")
      ? "AUDITOR"
      : roles.includes("SUPERVISOR")
        ? "SUPERVISOR"
        : roles.includes("CLIENTE")
          ? "CLIENTE"
          : "ADMIN";

  const [filters, setFilters] = useState<Filters>({
    search: "",
    category: ALL,
    issueType: ALL,
    severity: ALL,
    status: "__OPEN__",
    industryId: ALL,
    uf: ALL,
    assignedTo: null,
    dueState: null,
    month,
    year,
    page: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [mode, setMode] = useState<ListMode>("PERSISTED");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  // Debounce da busca (item 20).
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const patch = useCallback((next: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...next, page: next.page ?? 1 }));
  }, []);

  const overviewFn = useServerFn(mk9QualityOverviewFn);
  const listFn = useServerFn(mk9QualityListFn);
  const facetsFn = useServerFn(mk9QualityFacetsFn);
  const detailFn = useServerFn(mk9QualityDetailFn);
  const runFn = useServerFn(mk9QualityRunFn);
  const transitionFn = useServerFn(mk9QualityTransitionFn);
  const assignFn = useServerFn(mk9QualityAssignFn);
  const planningFn = useServerFn(mk9QualityPlanningFn);
  const reopenFn = useServerFn(mk9QualityReopenFn);
  const addCommentFn = useServerFn(mk9QualityAddCommentFn);
  const editCommentFn = useServerFn(mk9QualityEditCommentFn);
  const archiveCommentFn = useServerFn(mk9QualityArchiveCommentFn);

  const followUpQ = useQuery({
    queryKey: ["mk9-quality-followup"],
    queryFn: () => mk9QualityFollowUpFn({ data: {} } as any),
    staleTime: 60_000,
  });

  async function refreshIssue(id: string) {
    await queryClient.invalidateQueries({ queryKey: ["mk9-quality-detail", id] });
    await queryClient.invalidateQueries({ queryKey: ["mk9-quality-list"] });
    await queryClient.invalidateQueries({ queryKey: ["mk9-quality-followup"] });
    await queryClient.invalidateQueries({ queryKey: ["mk9-quality-overview"] });
  }

  const facetsQ = useQuery({
    queryKey: ["mk9-quality-facets"],
    queryFn: () => facetsFn({ data: {} }),
    staleTime: 5 * 60_000,
  });

  const overviewQ = useQuery({
    queryKey: ["mk9-quality-overview", filters.month, filters.year],
    queryFn: () => overviewFn({ data: { month: filters.month, year: filters.year } }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["mk9-quality-list", filters],
    queryFn: () =>
      listFn({
        data: {
          month: filters.month,
          year: filters.year,
          status: statusesFor(filters.status),
          category: filters.category === ALL ? null : (filters.category as Mk9QualityCategory),
          severity: filters.severity === ALL ? null : (filters.severity as Mk9QualitySeverity),
          issueType: filters.issueType === ALL ? null : filters.issueType,
          industryId: filters.industryId === ALL ? null : filters.industryId,
          uf: filters.uf === ALL ? null : filters.uf,
          assignedTo: filters.assignedTo,
          dueState: filters.dueState as any,
          search: filters.search || null,
          page: filters.page,
          pageSize: PAGE_SIZE,
        },
      }),
    enabled: mode === "PERSISTED",
    placeholderData: (prev) => prev,
  });

  const detailQ = useQuery({
    queryKey: ["mk9-quality-detail", selectedId],
    queryFn: () => detailFn({ data: { id: selectedId as string } }),
    enabled: !!selectedId,
  });

  const overview = overviewQ.data;
  const facets = facetsQ.data;
  const items = useMemo(() => sortIssues((listQ.data?.items ?? []) as Mk9QualityIssueView[]), [listQ.data]);
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canRunPersistent = facets?.canRunPersistentCycle ?? false;

  const industries = facets?.industries ?? [];
  const ufs = facets?.ufs ?? [];
  const issueTypes = useMemo(
    () => Object.keys(overview?.byIssueType ?? {}).sort((a, b) => issueTypeLabel(a).localeCompare(issueTypeLabel(b))),
    [overview],
  );

  async function handleRun() {
    if (running) return;
    setRunning(true);
    setRunMessage(null);
    try {
      const result = await runFn({ data: { month: filters.month, year: filters.year } });
      setRunMessage(
        canRunPersistent
          ? `Diagnóstico atualizado: ${result.persistedSummary.reduce((s, r) => s + r.created, 0)} nova(s), ` +
            `${result.persistedSummary.reduce((s, r) => s + r.autoResolved, 0)} resolvida(s) automaticamente.`
          : `Diagnóstico calculado em memória: ${result.realtimeCount} sinal(is). Seu escopo não grava histórico.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["mk9-quality-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["mk9-quality-list"] });
    } catch {
      setRunMessage("Não foi possível atualizar o diagnóstico agora. Tente novamente em instantes.");
    } finally {
      setRunning(false);
    }
  }

  const cards = useMemo(() => {
    const s = overview?.bySeverity ?? {};
    const st = overview?.byStatus ?? {};
    const open = (st.OPEN ?? 0) + (st.ACKNOWLEDGED ?? 0) + (st.IN_PROGRESS ?? 0) + (st.REOPENED ?? 0);
    const imports =
      (overview?.byIssueType?.PENDING_IMPORT_CONFLICT ?? 0) +
      (overview?.byIssueType?.CHECKLIST_IMPORT_WITHOUT_VALIDATION ?? 0) +
      (overview?.byIssueType?.EXCEL_DATABASE_DIVERGENCE ?? 0);
    return [
      { key: "open", label: "Problemas abertos", unit: "ocorrências em aberto", value: open, apply: { status: "__OPEN__", severity: ALL, category: ALL } },
      { key: "blk", label: "Bloqueantes", unit: "ocorrências bloqueantes", value: s.BLOQUEANTE ?? 0, apply: { severity: "BLOQUEANTE", status: "__OPEN__" }, tone: "danger" as const },
      { key: "crt", label: "Críticos", unit: "ocorrências críticas", value: s.CRITICO ?? 0, apply: { severity: "CRITICO", status: "__OPEN__" }, tone: "danger" as const },
      { key: "atn", label: "Atenção", unit: "ocorrências em atenção", value: s.ATENCAO ?? 0, apply: { severity: "ATENCAO", status: "__OPEN__" }, tone: "warn" as const },
      { key: "auto", label: "Resolvidos automaticamente", unit: "ocorrências encerradas pelo detector", value: st.RESOLVED_AUTO ?? 0, apply: { status: "RESOLVED_AUTO", severity: ALL } },
      { key: "imp", label: "Importações com problema", unit: "ocorrências de importação", value: imports, apply: { category: "IMPORTACAO", status: "__OPEN__", severity: ALL } },
    ];
  }, [overview]);

  const activeFilterCount = [
    filters.category !== ALL,
    filters.issueType !== ALL,
    filters.severity !== ALL,
    filters.industryId !== ALL,
    filters.uf !== ALL,
    filters.status !== "__OPEN__",
  ].filter(Boolean).length;

  const selectedIssue = detailQ.data?.issue as Mk9QualityIssueView | undefined;

  return (
    <div className="space-y-6">
      {/* ---------------- Cabeçalho ---------------- */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
            <h2 className="text-xl font-semibold tracking-tight">Qualidade dos Dados</h2>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Identifique inconsistências de cadastro, frequência, roteiro, execução e importação antes
            que afetem os relatórios.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Última execução: {dateTimeLabel(overview?.generatedAt)}
              {overview?.generatedAt ? ` (${relativeLabel(overview.generatedAt)})` : ""}
            </span>
            <span>Detectores executados: {overview?.detectorsExecuted ?? "—"}</span>
            <span>Competência: {competenceLabel(filters.month, filters.year)}</span>
            <span>
              Escopo: {facets?.role ?? role}
              {facets ? (facets.canViewAll ? " · visão completa" : " · escopo restrito") : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 lg:items-end">
          <div className="flex items-center gap-2">
            <Select value={String(filters.month)} onValueChange={(v) => patch({ month: Number(v) })}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS_PT.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number"
              className="h-9 w-[86px]"
              value={filters.year}
              min={2024}
              max={2100}
              onChange={(e) => patch({ year: Number(e.target.value) })}
              aria-label="Ano da competência"
            />
            <Button onClick={handleRun} disabled={running} className="h-9 gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar diagnóstico
            </Button>
          </div>
          {runMessage && <p className="max-w-sm text-right text-[11px] text-muted-foreground">{runMessage}</p>}
          {!canRunPersistent && facets && (
            <p className="max-w-sm text-right text-[11px] text-muted-foreground">
              Seu escopo executa o diagnóstico apenas em leitura: nenhuma ocorrência de histórico é gravada.
            </p>
          )}
        </div>
      </header>

      {overview?.failedDetectors?.length ? (
        <div className="flex items-start gap-2 rounded-xl border border-[color:var(--color-kpi-amber)]/40 bg-[color-mix(in_oklab,var(--color-kpi-amber)_10%,transparent)] p-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 text-[color:var(--color-kpi-amber)]" />
          <p className="text-muted-foreground">
            {countLabel(overview.failedDetectors.length, "ocorrencia").replace("ocorrência", "detector").replace("ocorrências", "detectores")}{" "}
            não puderam ser executados nesta rodada. Os demais resultados continuam válidos.
          </p>
        </div>
      ) : null}

      {/* ---------------- Cards ---------------- */}
      {overviewQ.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}
        </div>
      ) : overviewQ.isError ? (
        <ErrorBlock onRetry={() => overviewQ.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => (
            <button
              key={card.key}
              onClick={() => { setMode("PERSISTED"); patch(card.apply as Partial<Filters>); }}
              className={cn(
                "card-hover rounded-xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-primary/40",
                card.tone === "danger" && card.value > 0 && "border-destructive/30",
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{card.unit}</p>
            </button>
          ))}
        </div>
      )}

      {followUpQ.data?.summary && (
        <FollowUpPanel
          summary={followUpQ.data.summary}
          activeFilter={{ assignedTo: filters.assignedTo, dueState: filters.dueState }}
          onFilter={(next) => { setMode("PERSISTED"); patch(next as Partial<Filters>); }}
        />
      )}

      {/* ---------------- Diagnóstico consolidado ---------------- */}
      {overview?.diagnostic && (
        <Card className="border-border/70">
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Resumo do diagnóstico</p>
              <p className="text-sm text-muted-foreground">
                {describeConsolidation(overview.diagnostic.pairIssues, overview.diagnostic.pairSymptoms)}
              </p>
              <p className="text-sm text-muted-foreground">
                {describeIncompleteStores({
                  issues: overview.diagnostic.incompleteStoreIssues,
                  stores: overview.diagnostic.incompleteStores,
                  visits: overview.diagnostic.incompleteStoreVisits,
                })}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Metric label="Pares sem frequência" value={countLabel(overview.diagnostic.noFrequency, "par")} />
              <Metric label="Pares sem roteiro" value={countLabel(overview.diagnostic.noRoute, "par")} />
              <Metric label="Roteiro sem frequência" value={countLabel(overview.diagnostic.routeWithoutFrequency, "par")} />
              <Metric label="Frequência zerada" value={countLabel(overview.diagnostic.zeroFrequency, "par")} />
              <Metric label="Visitas sem roteiro" value={countLabel(overview.diagnostic.visitsWithoutRoute, "visita")} />
              <Metric
                label="Duplicatas prováveis"
                value={countLabel(overview.byIssueType?.PROBABLE_STORE_DUPLICATE ?? 0, "ocorrencia")}
              />
              <Metric
                label="Checklists sem validação"
                value={countLabel(overview.byIssueType?.CHECKLIST_IMPORT_WITHOUT_VALIDATION ?? 0, "importacao")}
              />
              <Metric
                label="Indústrias sem período"
                value={countLabel(overview.byIssueType?.INDUSTRY_WITHOUT_PERIOD_CONFIG ?? 0, "industria")}
              />
            </dl>
          </CardContent>
        </Card>
      )}

      {/* ---------------- Categorias ---------------- */}
      {overview && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Distribuição por categoria</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORY_ORDER.filter((c) => (overview.byCategory[c] ?? 0) > 0 || filters.category === c).map((cat) => {
              const value = overview.byCategory[cat] ?? 0;
              const max = Math.max(1, ...Object.values(overview.byCategory));
              const active = filters.category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setMode("PERSISTED"); patch({ category: active ? ALL : cat }); }}
                  className={cn(
                    "rounded-lg border border-border/70 bg-card p-3 text-left transition-colors hover:border-primary/40",
                    active && "border-primary/60 bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{CATEGORY_LABEL[cat]}</span>
                    <span className="tabular-nums text-muted-foreground">{value}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{countLabel(value, "ocorrencia")}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- Filtros ---------------- */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 md:max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por problema ou descrição…"
              className="h-9 pl-9"
              aria-label="Buscar ocorrências"
            />
          </div>
          <Select value={filters.severity} onValueChange={(v) => patch({ severity: v })}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as severidades</SelectItem>
              {SEVERITY_ORDER.map((s) => <SelectItem key={s} value={s}>{SEVERITY_META[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => patch({ status: v })}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__OPEN__">Em aberto</SelectItem>
              <SelectItem value={ALL}>Todos os status</SelectItem>
              {(Object.keys(STATUS_META) as Mk9QualityStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 gap-2">
                <Filter className="h-4 w-4" /> Filtros
                {activeFilterCount > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[300px] space-y-3">
              <FilterField label="Categoria">
                <Select value={filters.category} onValueChange={(v) => patch({ category: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {CATEGORY_ORDER.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Tipo de problema">
                <Select value={filters.issueType} onValueChange={(v) => patch({ issueType: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {issueTypes.map((t) => <SelectItem key={t} value={t}>{issueTypeLabel(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Indústria">
                <Select value={filters.industryId} onValueChange={(v) => patch({ industryId: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {industries.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="UF">
                <Select value={filters.uf} onValueChange={(v) => patch({ uf: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {ufs.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>
              <Button
                variant="ghost"
                className="h-8 w-full text-xs"
                onClick={() => { setSearchInput(""); setFilters((f) => ({ ...f, search: "", category: ALL, issueType: ALL, severity: ALL, status: "__OPEN__", industryId: ALL, uf: ALL, page: 1 })); }}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Limpar filtros
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        <div className="inline-flex rounded-lg border border-border/70 p-0.5">
          {(["PERSISTED", "REALTIME"] as ListMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              title={m === "PERSISTED" ? "Ocorrência acompanhada com histórico." : "Situação calculada agora, sem histórico."}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === m ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "PERSISTED" ? "Acompanhadas" : "Calculadas agora"}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- Lista ---------------- */}
      {mode === "REALTIME" ? (
        <RealtimePanel overview={overview} loading={overviewQ.isLoading} />
      ) : listQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : listQ.isError ? (
        <ErrorBlock onRetry={() => listQ.refetch()} />
      ) : items.length === 0 ? (
        <EmptyBlock filtered={activeFilterCount > 0 || !!filters.search} />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-border/70 lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Severidade</th>
                  <th className="p-3 font-medium">Problema</th>
                  <th className="p-3 font-medium">Entidade</th>
                  <th className="p-3 font-medium">Competência</th>
                  <th className="p-3 font-medium">Última detecção</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((issue) => (
                  <tr key={issue.id} className="border-t border-border/60 hover:bg-accent/40">
                    <td className="p-3"><SeverityBadge severity={issue.severity} /></td>
                    <td className="max-w-[320px] p-3">
                      <p className="truncate font-medium">{issue.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{issueTypeLabel(issue.issueType)}</p>
                    </td>
                    <td className="max-w-[220px] p-3 text-muted-foreground">
                      <p className="truncate">{entityLabel(issue)}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{competenceLabel(issue.competenceMonth, issue.competenceYear)}</td>
                    <td className="p-3 text-muted-foreground" title={dateTimeLabel(issue.lastSeenAt)}>{relativeLabel(issue.lastSeenAt)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={issue.status} />
                        <PriorityBadge priority={issue.priority} />
                        <DueBadge issue={issue} />
                      </div>
                      <div className="mt-1"><AssigneeBadge name={issue.assignedToName} /></div>
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedId(issue.id)}>
                        Detalhar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet */}
          <div className="grid gap-2 lg:hidden">
            {items.map((issue) => (
              <button
                key={issue.id}
                onClick={() => setSelectedId(issue.id)}
                className="rounded-xl border border-border/70 bg-card p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <SeverityBadge severity={issue.severity} />
                  <StatusBadge status={issue.status} />
                </div>
                <p className="mt-2 font-medium">{issue.title}</p>
                <p className="text-xs text-muted-foreground">{entityLabel(issue)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {competenceLabel(issue.competenceMonth, issue.competenceYear)} · {relativeLabel(issue.lastSeenAt)}
                </p>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{countLabel(total, "ocorrencia")} · página {filters.page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={filters.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={filters.page >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Próxima</Button>
            </div>
          </div>
        </>
      )}

      {/* ---------------- Detalhe ---------------- */}
      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {detailQ.isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-6 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
            </div>
          ) : detailQ.isError ? (
            <div className="p-6"><ErrorBlock onRetry={() => detailQ.refetch()} /></div>
          ) : selectedIssue ? (
            <IssueDetail
              issue={selectedIssue}
              events={detailQ.data?.events ?? []}
              comments={detailQ.data?.comments ?? []}
              role={role}
              currentUserId={followUpQ.data?.currentUserId ?? null}
              users={followUpQ.data?.users ?? []}
              stillDetected={
                selectedIssue.status === "OPEN" ||
                selectedIssue.status === "ACKNOWLEDGED" ||
                selectedIssue.status === "IN_PROGRESS" ||
                selectedIssue.status === "REOPENED"
              }
              onNavigate={onNavigate}
              onTransition={async (input) => {
                await transitionFn({
                  data: {
                    id: selectedIssue.id,
                    toStatus: input.toStatus,
                    reason: input.reason || null,
                    resolutionType: input.resolutionType ?? null,
                    forced: input.forced ?? false,
                    ignoreUntil: input.ignoreUntil ?? null,
                    expectedUpdatedAt: selectedIssue.updatedAt,
                  } as any,
                });
                await refreshIssue(selectedIssue.id);
              }}
              onReopen={async (reason) => {
                await reopenFn({ data: { id: selectedIssue.id, reason, expectedUpdatedAt: selectedIssue.updatedAt } as any });
                await refreshIssue(selectedIssue.id);
              }}
              onAssign={async (assigneeId, note) => {
                await assignFn({ data: { id: selectedIssue.id, assigneeId, note, expectedUpdatedAt: selectedIssue.updatedAt } as any });
                await refreshIssue(selectedIssue.id);
              }}
              onPlanning={async (input) => {
                await planningFn({ data: { id: selectedIssue.id, ...input, expectedUpdatedAt: selectedIssue.updatedAt } as any });
                await refreshIssue(selectedIssue.id);
              }}
              onAddComment={async (body, visibility) => {
                await addCommentFn({ data: { issueId: selectedIssue.id, body, visibility } as any });
                await refreshIssue(selectedIssue.id);
              }}
              onEditComment={async (commentId, body) => {
                await editCommentFn({ data: { issueId: selectedIssue.id, commentId, body } as any });
                await refreshIssue(selectedIssue.id);
              }}
              onArchiveComment={async (commentId) => {
                await archiveCommentFn({ data: { issueId: selectedIssue.id, commentId } as any });
                await refreshIssue(selectedIssue.id);
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocos auxiliares
// ---------------------------------------------------------------------------

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{value}</dd>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <CircleAlert className="mx-auto h-6 w-6 text-destructive" />
      <p className="mt-2 text-sm font-medium">Não foi possível carregar o diagnóstico</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Verifique sua conexão e tente novamente. Se o problema persistir, avise a administração.
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Tentar novamente</Button>
    </div>
  );
}

function EmptyBlock({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <CircleCheck className="mx-auto h-7 w-7 text-[color:var(--color-kpi-green)]" />
      <p className="mt-2 text-sm font-medium">
        {filtered
          ? "Nenhum problema encontrado com os filtros selecionados."
          : "Nenhum problema de qualidade em aberto nesta competência."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {filtered
          ? "Ajuste os filtros ou limpe a seleção para ver o restante do diagnóstico."
          : "Os detectores rodaram e não encontraram inconsistências no seu escopo."}
      </p>
    </div>
  );
}

function RealtimePanel({
  overview,
  loading,
}: {
  overview: { realtime: Array<{ issueType: string; severity: Mk9QualitySeverity; count: number; title: string }> } | undefined;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-40 rounded-xl" />;
  const rows = overview?.realtime ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong className="font-medium text-foreground">Situação calculada agora.</strong>{" "}
          Estes sinais não têm histórico e não aceitam ações de status — eles refletem apenas o
          resultado da última execução dos detectores.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyBlock filtered={false} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.issueType} className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <SeverityBadge severity={r.severity} />
                <span className="text-lg font-semibold tabular-nums">{r.count}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{r.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {issueTypeLabel(r.issueType)} · {countLabel(r.count, "ocorrencia")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function entityLabel(issue: Mk9QualityIssueView): string {
  const e = issue.evidence ?? {};
  const store = typeof e.storeName === "string" ? e.storeName : null;
  const industry = typeof e.industryName === "string" ? e.industryName : null;
  if (store && industry) return `${store} × ${industry}`;
  return store ?? industry ?? issue.entityType;
}

// ---------------------------------------------------------------------------
// Detalhe da ocorrência
// ---------------------------------------------------------------------------

function IssueDetail({
  issue,
  events,
  role,
  onNavigate,
  onTransition,
}: {
  issue: Mk9QualityIssueView;
  events: any[];
  role: string;
  onNavigate?: (target: ResolvedNavigation) => void;
  onTransition: (target: Mk9ManualTransition, reason: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<Mk9ManualTransition | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  const rows = evidenceRows(issue.issueType, issue.evidence);
  const symptoms = issueSymptoms(issue.evidence);
  const nav = resolveIssueNavigation(issue);
  const isAdmin = role === "ADMIN" || role === "DEV" || role === "AUDITOR";
  const transitions = availableTransitions({ role, status: issue.status, persisted: true });
  const option = transitions.find((t) => t.target === pending);

  async function confirm() {
    if (!option) return;
    if (option.reasonRequired && reason.trim().length < (option.target === "IGNORED" ? 5 : 3)) {
      setError(
        option.target === "IGNORED"
          ? "Justificativa obrigatória (mínimo 5 caracteres)."
          : "Nota de resolução obrigatória (mínimo 3 caracteres).",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onTransition(option.target, reason.trim());
      setPending(null);
      setReason("");
    } catch {
      setError("Não foi possível registrar esta ação. Ela pode não ser permitida para o seu papel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 p-6">
      <SheetHeader className="space-y-2 p-0">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={issue.severity} />
          <StatusBadge status={issue.status} />
          <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[issue.category]}</Badge>
        </div>
        <SheetTitle className="text-left text-lg">{issue.title}</SheetTitle>
        <SheetDescription className="text-left">{issue.description}</SheetDescription>
      </SheetHeader>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border/70 p-4 text-sm">
        <Metric label="Entidade afetada" value={entityLabel(issue)} />
        <Metric label="Competência" value={competenceLabel(issue.competenceMonth, issue.competenceYear)} />
        <Metric label="Primeira detecção" value={dateTimeLabel(issue.firstDetectedAt)} />
        <Metric label="Última detecção" value={dateTimeLabel(issue.lastSeenAt)} />
      </dl>

      {symptoms.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-semibold">Problemas identificados</p>
          <ul className="space-y-1.5">
            {symptoms.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive/70" />
                {s}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Uma única ocorrência consolida {countLabel(symptoms.length, "sintoma")} do mesmo par.
          </p>
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-semibold">Evidências</p>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{r.label}</dt>
                <dd className={cn("truncate text-sm", r.emphasis && "font-semibold")}>{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {issue.suggestedAction && (
        <section className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-primary">Ação recomendada</p>
          <p className="mt-1 text-sm text-muted-foreground">{issue.suggestedAction}</p>
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate?.(nav)}>
          <ArrowUpRight className="h-4 w-4" /> {NAVIGATION_LABEL[nav.module]}
        </Button>
      </section>

      {transitions.length > 0 && (
        <section className="space-y-2">
          <Separator />
          <p className="text-sm font-semibold">Tratativa</p>
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <Button
                key={t.target}
                size="sm"
                variant={t.danger ? "destructive" : pending === t.target ? "default" : "outline"}
                onClick={() => { setPending(pending === t.target ? null : t.target); setReason(""); setError(null); }}
              >
                {t.label}
              </Button>
            ))}
          </div>
          {option && (
            <div className="space-y-2 rounded-lg border border-border/70 p-3">
              {option.warning && (
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {option.warning}
                </p>
              )}
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={
                  option.reasonRequired
                    ? option.target === "IGNORED"
                      ? "Justificativa obrigatória para ignorar…"
                      : "Nota de resolução obrigatória: o que foi corrigido?"
                    : "Comentário opcional…"
                }
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
                <Button size="sm" onClick={confirm} disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Confirmar {option.label.toLowerCase()}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2">
        <Separator />
        <p className="flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4" /> Histórico</p>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum evento registrado para esta ocorrência.</p>
        ) : (
          <ol className="space-y-3 border-l border-border pl-4">
            {events.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary/70" />
                <p className="text-sm font-medium">{eventLabel(ev.event_type)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {dateTimeLabel(ev.created_at)}
                  {ev.from_status && ev.to_status
                    ? ` · ${STATUS_META[ev.from_status as Mk9QualityStatus]?.label ?? ev.from_status} → ${
                        STATUS_META[ev.to_status as Mk9QualityStatus]?.label ?? ev.to_status
                      }`
                    : ""}
                </p>
                {ev.reason && <p className="mt-0.5 text-xs text-muted-foreground">“{ev.reason}”</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {isAdmin && (
        <section className="space-y-2">
          <Separator />
          <button
            onClick={() => setShowTechnical((v) => !v)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showTechnical ? "Ocultar" : "Mostrar"} detalhes técnicos
          </button>
          {showTechnical && (
            <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-border/70 p-3 sm:grid-cols-2">
              {technicalRows(issue).map((r) => (
                <div key={r.label} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.label}</dt>
                  <dd className="truncate font-mono text-[11px]">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </div>
  );
}
