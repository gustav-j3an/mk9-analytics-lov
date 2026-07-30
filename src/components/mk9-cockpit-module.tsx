/**
 * MK9 — Cockpit Operacional: interface (Centro de Comando).
 *
 * Consome UM único payload fechado (`mk9CockpitOverviewFn`). A tela não
 * calcula nada e não decide permissão: apenas apresenta o que o servidor
 * autorizou. Esta camada é 100% apresentação — nenhuma regra operacional,
 * nenhum número derivado além de formatação e ordenação visual.
 *
 * Ordem de leitura (primeira dobra):
 *   Resumo executivo → Saúde → O que fazer agora → Ações rápidas → KPIs
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Factory,
  FileText,
  Gauge,
  Info,
  Map as MapIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  Store as StoreIcon,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { mk9ListIndustries, mk9ListPromoters } from "@/lib/mk9-data.functions";
import { mk9CockpitOverviewFn } from "@/lib/mk9-cockpit.functions";
import { AMBIGUOUS_WARNING_THRESHOLD } from "@/lib/mk9-cockpit/view";
import type {
  Mk9CockpitOverview,
  Mk9HealthLevel,
  Mk9QuickActionId,
} from "@/lib/mk9-cockpit/types";
import type { IndustryStatusKey } from "@/lib/mk9-operations/types";
import { INDUSTRY_STATUS_LABEL } from "@/lib/mk9-operations/types";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ALL = "__ALL__";

/* ---------------------------------------------------------------------------
 * Paleta padronizada (item 13): verde saudável · amarelo atenção ·
 * laranja crítica · vermelho bloqueada · azul informativo.
 * ------------------------------------------------------------------------ */
const HEALTH_STYLE: Record<
  Mk9HealthLevel,
  { label: string; card: string; chip: string; dot: string; accent: string; Icon: typeof AlertTriangle }
> = {
  BLOQUEADA: {
    label: "OPERAÇÃO BLOQUEADA",
    card: "border-red-500/40 bg-red-500/10",
    chip: "bg-red-500/15 text-red-600 border-red-500/30",
    dot: "bg-red-500",
    accent: "text-red-600",
    Icon: AlertOctagon,
  },
  CRITICA: {
    label: "OPERAÇÃO CRÍTICA",
    card: "border-orange-500/40 bg-orange-500/10",
    chip: "bg-orange-500/15 text-orange-600 border-orange-500/30",
    dot: "bg-orange-500",
    accent: "text-orange-600",
    Icon: AlertTriangle,
  },
  ATENCAO: {
    label: "OPERAÇÃO EM ATENÇÃO",
    card: "border-amber-500/40 bg-amber-500/10",
    chip: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    dot: "bg-amber-500",
    accent: "text-amber-600",
    Icon: Info,
  },
  SAUDAVEL: {
    label: "OPERAÇÃO SAUDÁVEL",
    card: "border-emerald-500/40 bg-emerald-500/10",
    chip: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    dot: "bg-emerald-500",
    accent: "text-emerald-600",
    Icon: CheckCircle2,
  },
};

const STATUS_STYLE: Record<IndustryStatusKey, string> = {
  CONCLUIDA: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  EM_DIA: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  ATENCAO: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  CRITICA: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  SEM_CHECKLIST: "bg-red-500/15 text-red-600 border-red-500/30",
  SEM_FREQUENCIA: "bg-sky-500/15 text-sky-600 border-sky-500/30",
};

const HEALTH_SENTENCE: Record<Mk9HealthLevel, string> = {
  BLOQUEADA: "bloqueada",
  CRITICA: "crítica",
  ATENCAO: "em atenção",
  SAUDAVEL: "saudável",
};

const CONFIDENCE_LABEL: Record<string, string> = { ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };

const ACTION_ICON: Record<Mk9QuickActionId, typeof Gauge> = {
  IMPORT_BASE: Upload,
  IMPORT_CHECKLIST: ClipboardList,
  AUDIT: Search,
  QUALITY: ShieldCheck,
  ROUTES: MapIcon,
  REPORTS: FileText,
};

function shortDate(value: string | null) {
  if (!value) return "—";
  const iso = value.slice(0, 10);
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : iso;
}

function timeOf(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

/**
 * Resumo executivo 100% determinístico: só reescreve, em frases, números que
 * já vieram prontos no payload. Sem IA, sem cálculo novo.
 */
function executiveSummary(data: Mk9CockpitOverview): string[] {
  const lines: string[] = [];
  lines.push(`A operação está ${HEALTH_SENTENCE[data.health.level].toUpperCase()}.`);
  lines.push(`A cobertura atual é de ${data.kpis.coberturaPct}%.`);
  lines.push(
    data.kpis.pendentes === 1
      ? "Existe 1 visita pendente."
      : `Existem ${data.kpis.pendentes} visitas pendentes.`,
  );

  const names = data.priorities
    .map((p) => p.title)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 3);
  if (names.length > 0) {
    const list =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
    lines.push(`${names.length === 1 ? "A maior prioridade é" : "As maiores prioridades são"} ${list}.`);
  } else {
    lines.push("Nenhuma prioridade aberta nos filtros atuais.");
  }

  lines.push(
    `Mantendo o ritmo atual, a projeção é de aproximadamente ${data.forecast.projectedCoveragePct}%.`,
  );
  return lines;
}

export interface Mk9CockpitModuleProps {
  /** Navegação de drill-down usando SEMPRE o destino devolvido pelo servidor. */
  onNavigate?: (target: string) => void;
}

export function Mk9CockpitModule({ onNavigate }: Mk9CockpitModuleProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [industryId, setIndustryId] = useState<string>(ALL);
  const [uf, setUf] = useState<string>(ALL);
  const [promoterId, setPromoterId] = useState<string>(ALL);
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [showQualityDetails, setShowQualityDetails] = useState(false);

  const overviewFn = useServerFn(mk9CockpitOverviewFn);
  const industriesFn = useServerFn(mk9ListIndustries);
  const promotersFn = useServerFn(mk9ListPromoters);

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn() });
  const promotersQ = useQuery({ queryKey: ["mk9-promoters"], queryFn: () => promotersFn() });

  const filters = {
    year,
    month,
    industryId: industryId === ALL ? null : industryId,
    uf: uf === ALL ? null : uf,
    promoterId: promoterId === ALL ? null : promoterId,
  };

  const q = useQuery<Mk9CockpitOverview>({
    queryKey: ["mk9-cockpit", filters.year, filters.month, filters.industryId, filters.uf, filters.promoterId],
    queryFn: () => overviewFn({ data: filters }) as Promise<Mk9CockpitOverview>,
    staleTime: 60_000,
  });

  const data = q.data;
  const series = useMemo(
    () =>
      (data?.series ?? []).map((p) => ({
        semana: shortDate(p.date),
        esperado: p.expected,
        realizado: p.realized,
        diferenca: p.diff,
      })),
    [data?.series],
  );

  const summary = useMemo(() => (data ? executiveSummary(data) : []), [data]);

  const go = (target: string | null) => {
    if (!target) return;
    if (onNavigate) onNavigate(target);
    else window.location.assign(target);
  };

  if (q.isLoading) return <CockpitSkeleton />;

  if (q.isError) {
    const message = (q.error as Error)?.message ?? "";
    const denied = /403|permiss|autoriz|scope/i.test(message);
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            <p className="font-semibold">{denied ? "Sem permissão para o Cockpit" : "Não foi possível carregar o Cockpit"}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {denied
              ? "Seu perfil não tem acesso a esta visão. Fale com um administrador."
              : "Tente atualizar. Se persistir, verifique a competência selecionada."}
          </p>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return <CockpitSkeleton />;

  const health = HEALTH_STYLE[data.health.level];
  const HealthIcon = health.Icon;
  const isClient = data.viewer.role === "CLIENTE";
  const topRisk = data.priorities[0]?.title ?? "—";
  const timeline = showAllTimeline ? data.timeline : data.timeline.slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- cabeçalho + filtros ---------- */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 lg:flex lg:flex-wrap lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">Cockpit Operacional</h2>
          <p className="text-xs text-muted-foreground">
            {data.periodLabel} · {shortDate(data.windowStart)} a {shortDate(data.windowEnd)} · atualizado às{" "}
            {timeOf(data.generatedAt)} · escopo {data.viewer.role}
            {q.isFetching && <span className="ml-2 italic">atualizando…</span>}
          </p>
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-auto">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-9 w-[130px]" aria-label="Competência: mês"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS_PT.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-[96px]" aria-label="Competência: ano"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={industryId} onValueChange={setIndustryId}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="Filtrar por indústria"><SelectValue placeholder="Indústria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as indústrias</SelectItem>
              {(industriesQ.data ?? []).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger className="h-9 w-[110px]" aria-label="Filtrar por UF"><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as UFs</SelectItem>
              {data.availableUfs.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          {data.viewer.canViewPersonalData && (
            <Select value={promoterId} onValueChange={setPromoterId}>
              <SelectTrigger className="h-9 w-[170px]" aria-label="Filtrar por promotor"><SelectValue placeholder="Promotor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os promotores</SelectItem>
                {(promotersQ.data ?? []).slice(0, 200).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" disabled={q.isFetching} onClick={() => q.refetch()} aria-label="Atualizar dados do cockpit">
            <RefreshCw className={cn("mr-2 h-4 w-4", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        </div>
      </header>

      {/* ---------- 1ª DOBRA · resumo executivo ---------- */}
      <section
        aria-label="Resumo executivo"
        className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">Resumo executivo</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{summary.join(" ")}</p>
      </section>

      {/* ---------- 1ª DOBRA · saúde operacional ---------- */}
      <section className={cn("rounded-xl border p-4", health.card)} aria-label="Saúde operacional">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", health.dot)} aria-hidden />
            <HealthIcon className={cn("h-5 w-5 shrink-0", health.accent)} aria-hidden />
            <p className={cn("truncate text-sm font-bold tracking-wide sm:text-base", health.accent)}>
              {health.label}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {data.health.blockingIssues > 0 && (
              <Badge variant="outline" className={cn("text-[11px]", HEALTH_STYLE.BLOQUEADA.chip)}>
                {data.health.blockingIssues} bloqueante(s)
              </Badge>
            )}
            {data.health.overdueIssues > 0 && (
              <Badge variant="outline" className={cn("text-[11px]", HEALTH_STYLE.ATENCAO.chip)}>
                {data.health.overdueIssues} vencida(s)
              </Badge>
            )}
            {data.health.failedImports > 0 && !isClient && (
              <Badge variant="outline" className={cn("text-[11px]", HEALTH_STYLE.BLOQUEADA.chip)}>
                {data.health.failedImports} importação(ões) com falha
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HealthMetric label="Cobertura" value={`${data.kpis.coberturaPct}%`} accent={health.accent} />
          <HealthMetric label="Pendentes" value={String(data.kpis.pendentes)} accent={health.accent} />
          <HealthMetric label="Maior risco" value={topRisk} accent={health.accent} small />
          <HealthMetric label="Ritmo" value={`${data.health.pacePercentage}%`} accent={health.accent} />
        </div>

        <p className="mt-3 text-xs leading-relaxed text-foreground/70">{data.health.reason}</p>
      </section>

      {/* ---------- 1ª DOBRA · o que fazer agora + ações rápidas ---------- */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="order-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              🚨 O que fazer agora
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.priorities.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma prioridade aberta para os filtros atuais.</p>
            )}
            {data.priorities.map((p, index) => (
              <div
                key={p.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                </div>
                {p.deepLink ? (
                  <Button size="sm" variant="secondary" className="shrink-0" onClick={() => go(p.deepLink)}>
                    Abrir <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{p.impact}</span>
                )}
              </div>
            ))}
            {data.priorityMoreCount > 0 && (
              <p className="text-xs text-muted-foreground">+ {data.priorityMoreCount} outras prioridades</p>
            )}
          </CardContent>
        </Card>

        <Card className="order-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Ações rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {data.quickActions.map((a) => {
              const Icon = ACTION_ICON[a.id] ?? BarChart3;
              return (
                <button
                  key={a.id}
                  onClick={() => go(a.target)}
                  className="flex h-[72px] flex-col items-start justify-between rounded-lg border border-border/70 bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                  <span className="text-xs font-medium leading-tight">{a.label}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ---------- 1ª DOBRA · KPIs ---------- */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores principais">
        <Kpi label="Contratadas" value={data.kpis.contratadas} Icon={ClipboardCheck} />
        <Kpi label="Realizadas" value={data.kpis.realizadas} Icon={CheckCircle2} />
        <Kpi label="Pendentes" value={data.kpis.pendentes} Icon={Clock} />
        <Kpi label="Cobertura" value={`${data.kpis.coberturaPct}%`} Icon={Gauge} />
        <Kpi label="Lojas sem visita" value={data.kpis.lojasSemVisita} Icon={StoreIcon} onClick={() => go("/?module=audit")} />
        <Kpi label="Indústrias em risco" value={data.kpis.industriasEmRisco} Icon={Factory} onClick={() => go("/?module=audit")} />
      </section>

      {/* ================= ABAIXO DA DOBRA ================= */}

      {/* ---------- previsão + checklists + qualidade ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Previsão de fechamento</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-around gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hoje</p>
                <p className="text-2xl font-bold tabular-nums">{data.kpis.coberturaPct}%</p>
              </div>
              <ArrowDown className="h-5 w-5 shrink-0 rotate-[-90deg] text-muted-foreground" aria-hidden />
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Projeção</p>
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    data.forecast.projectedCoveragePct >= data.kpis.coberturaPct ? "text-emerald-600" : "text-orange-600",
                  )}
                >
                  {data.forecast.projectedCoveragePct}%
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Confiança</p>
                <p className="text-base font-semibold">
                  {CONFIDENCE_LABEL[data.forecast.confidence] ?? data.forecast.confidence}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ritmo necessário</p>
                <p className="text-base font-semibold tabular-nums">{data.forecast.requiredDailyPace} / dia</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {data.forecast.daysRemaining} dia(s) restantes. A projeção pondera 60% do ritmo das últimas 2 semanas e
              40% do ritmo do período — é estimativa, não garantia.
            </p>
          </CardContent>
        </Card>

        {!isClient && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Checklists e importações</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-1.5">
                <StatusLine
                  tone="ok"
                  label="Importações da competência"
                  value={data.checklists.imports}
                />
                <StatusLine
                  tone="warn"
                  label="Indústrias sem checklist"
                  value={data.checklists.industriesWithoutChecklist}
                />
                <StatusLine tone="fail" label="Importações com falha" value={data.checklists.failedImports} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Última importação: {shortDate(data.checklists.lastImportAt)}
              </p>
              {data.viewer.canViewImports && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => go("/?module=checklists")}>
                  Abrir Checklists
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Qualidade dos dados</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-2 text-center">
              <QualityStat label="Bloqueantes" value={data.quality.blocking} tone="fail" />
              <QualityStat label="Críticas" value={data.quality.overdue} tone="warn" />
              <QualityStat label="Abertas" value={data.quality.open} tone="info" />
            </div>
            <button
              className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowQualityDetails((v) => !v)}
            >
              {showQualityDetails ? "Ocultar detalhes" : "Ver detalhes"}
            </button>
            {showQualityDetails && (
              <div className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
                <Row label="Sem responsável" value={String(data.quality.unassigned)} />
                <Row label="Com prazo vencido" value={String(data.quality.overdue)} />
              </div>
            )}
            <Button size="sm" variant="outline" className="mt-2" onClick={() => go("/?module=quality")}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Abrir Centro de Qualidade
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ---------- indústrias ---------- */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Situação das indústrias</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {data.industries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma indústria no escopo/filtros atuais.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {data.industries.slice(0, 10).map((i) => (
                <button
                  key={i.industryId}
                  onClick={() => go(`/?module=audit&industry=${i.industryId}`)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:grid-cols-[minmax(0,1.6fr)_auto_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{i.industryName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {i.realizadas}/{i.contratadas} visitas · ritmo {i.pacePercentage}% · {i.openIssues} ocorrência(s)
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0 text-[10px]", STATUS_STYLE[i.status])}>
                    {INDUSTRY_STATUS_LABEL[i.status]}
                  </Badge>
                  <div className="hidden w-16 text-right sm:block">
                    <p className="text-sm font-bold tabular-nums">{i.coberturaPct}%</p>
                    <p className="text-[10px] uppercase text-muted-foreground">cobertura</p>
                  </div>
                  <div className="hidden w-16 text-right sm:block">
                    <p className="text-sm font-bold tabular-nums">{Math.max(0, i.contratadas - i.realizadas)}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">pendentes</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- tendência ---------- */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Tendência semanal</CardTitle></CardHeader>
        <CardContent className="h-[220px] pt-0" aria-label="Gráfico semanal de esperado versus realizado">
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem série disponível para o período.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="semana" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip
                  formatter={(value: any, name: any) => [value, name]}
                  labelFormatter={(l) => `Semana de ${l}`}
                />
                <Legend />
                <Line type="monotone" dataKey="esperado" stroke="var(--color-chart-2)" dot={false} name="Esperado" />
                <Line type="monotone" dataKey="realizado" stroke="var(--color-chart-1)" dot={false} name="Realizado" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ---------- promotores + supervisores ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.viewer.canViewPersonalData && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Promotores que exigem atenção</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {data.promoters.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum promotor em atenção.</p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {data.promoters.map((p) => (
                  <div key={p.promoterId} className="rounded-lg border border-border/60 p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate text-sm font-semibold">{p.promoterName}</span>
                    </div>
                    <div className="mt-2 flex gap-4">
                      <div>
                        <p className="text-base font-bold tabular-nums">{p.coberturaPct}%</p>
                        <p className="text-[10px] uppercase text-muted-foreground">cobertura</p>
                      </div>
                      <div>
                        <p className="text-base font-bold tabular-nums">{p.pendentes}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">pendentes</p>
                      </div>
                    </div>
                    <p className="mt-2 truncate text-[11px] text-muted-foreground">
                      Última atividade: {shortDate(p.lastVisit)}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{p.industries.join(", ") || "—"}</p>
                    {p.ambiguousShare > AMBIGUOUS_WARNING_THRESHOLD && (
                      <Badge variant="outline" className={cn("mt-2 text-[10px]", HEALTH_STYLE.ATENCAO.chip)}>
                        Atribuição parcial
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Supervisores</CardTitle></CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            {data.supervisors.available ? <p>Indicador disponível.</p> : <p>{data.supervisors.reason}</p>}
          </CardContent>
        </Card>
      </div>

      {/* ---------- timeline ---------- */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide">Linha do tempo</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1.5 pt-0 text-sm">
          {data.timeline.length === 0 && (
            <p className="text-muted-foreground">Nenhum evento registrado no escopo atual.</p>
          )}
          {timeline.map((e) => (
            <div key={e.id} className="flex items-start gap-2.5 border-b border-border/40 pb-1.5 last:border-0">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-xs">{e.description}</p>
                <p className="text-[11px] text-muted-foreground">
                  {shortDate(e.at)} {timeOf(e.at)}
                  {e.industryName ? ` · ${e.industryName}` : ""}
                </p>
              </div>
            </div>
          ))}
          {data.timeline.length > 5 && (
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => setShowAllTimeline((v) => !v)}
            >
              {showAllTimeline ? "Mostrar menos" : "Ver histórico"}
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="text-right text-[11px] text-muted-foreground">
        Payload gerado em {data.perf.totalMs} ms · {data.perf.queryCount} consultas
      </p>
    </div>
  );
}

function HealthMetric({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent: string;
  small?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-background/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("truncate font-bold tabular-nums", small ? "text-base" : "text-2xl", accent)}>{value}</p>
    </div>
  );
}

function StatusLine({
  tone,
  label,
  value,
}: {
  tone: "ok" | "warn" | "fail";
  label: string;
  value: number;
}) {
  const mark = tone === "ok" ? "✔" : tone === "warn" ? "⚠" : "✖";
  const color =
    tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <span className={cn("shrink-0", color)} aria-hidden>{mark}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function QualityStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "fail" | "warn" | "info";
}) {
  const color =
    tone === "fail" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-sky-600";
  return (
    <div className="rounded-lg border border-border/60 px-2 py-2">
      <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Kpi({
  label,
  value,
  Icon,
  onClick,
}: {
  label: string;
  value: string | number;
  Icon: typeof Gauge;
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border/70 bg-card px-3 py-3 text-left",
        onClick && "transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
    >
      <p className="text-2xl font-bold leading-none tabular-nums sm:text-3xl">{value}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" aria-hidden /> <span className="truncate">{label}</span>
      </div>
    </Comp>
  );
}

function CockpitSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando cockpit">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    </div>
  );
}
