/**
 * MK9 — Cockpit Operacional (Fase 3.1C): interface.
 *
 * Consome UM único payload fechado (`mk9CockpitOverviewFn`). A tela não
 * calcula nada e não decide permissão: apenas apresenta o que o servidor
 * autorizou, na ordem de leitura acordada (saúde → prioridades → ações).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Factory,
  Gauge,
  Info,
  RefreshCw,
  ShieldCheck,
  Store as StoreIcon,
  TrendingUp,
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
import type { Mk9CockpitOverview, Mk9HealthLevel } from "@/lib/mk9-cockpit/types";
import { INDUSTRY_STATUS_LABEL } from "@/lib/mk9-operations/types";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ALL = "__ALL__";

const HEALTH_STYLE: Record<Mk9HealthLevel, { label: string; className: string; Icon: typeof AlertTriangle }> = {
  BLOQUEADA: { label: "OPERAÇÃO BLOQUEADA", className: "border-destructive/40 bg-destructive/10 text-destructive", Icon: AlertOctagon },
  CRITICA: { label: "OPERAÇÃO CRÍTICA", className: "border-destructive/30 bg-destructive/5 text-destructive", Icon: AlertTriangle },
  ATENCAO: { label: "OPERAÇÃO EM ATENÇÃO", className: "border-amber-500/40 bg-amber-500/10 text-amber-600", Icon: Info },
  SAUDAVEL: { label: "OPERAÇÃO SAUDÁVEL", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600", Icon: CheckCircle2 },
};

const CONFIDENCE_LABEL: Record<string, string> = { ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };

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

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- cabeçalho + filtros ---------- */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Cockpit Operacional</h2>
          <p className="text-sm text-muted-foreground">
            {data.periodLabel} · Período: {shortDate(data.windowStart)} a {shortDate(data.windowEnd)}
          </p>
          <p className="text-xs text-muted-foreground">
            Atualizado às {timeOf(data.generatedAt)} · escopo: {data.viewer.role}
            {q.isFetching && <span className="ml-2 italic">atualizando…</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {/* ---------- saúde geral ---------- */}
      <section className={cn("rounded-xl border p-4", health.className)} aria-label="Saúde geral da operação">
        <div className="flex flex-wrap items-center gap-3">
          <HealthIcon className="h-5 w-5" aria-hidden />
          <p className="text-sm font-semibold tracking-wide">{health.label}</p>
          <Badge variant="outline" className="border-current text-[11px]">Ritmo {data.health.pacePercentage}%</Badge>
          {data.health.blockingIssues > 0 && (
            <Badge variant="outline" className="border-current text-[11px]">{data.health.blockingIssues} bloqueante(s)</Badge>
          )}
          {data.health.overdueIssues > 0 && (
            <Badge variant="outline" className="border-current text-[11px]">{data.health.overdueIssues} vencida(s)</Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground/80">{data.health.reason}</p>
      </section>

      {/* ---------- prioridades + ações rápidas ---------- */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prioridades do dia</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.priorities.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma prioridade aberta para os filtros atuais.</p>
            )}
            {data.priorities.map((p, index) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-muted text-xs font-semibold">{index + 1}</span>
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <Badge variant="outline" className="text-[10px]">{p.kind.replaceAll("_", " ").toLowerCase()}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    Impacto {p.impact} · pontuação {p.score}
                  </p>
                </div>
                {p.deepLink && (
                  <Button size="sm" variant="ghost" className="shrink-0" onClick={() => go(p.deepLink)}>
                    Abrir <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {data.priorityMoreCount > 0 && (
              <p className="text-xs text-muted-foreground">+ {data.priorityMoreCount} outras prioridades</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Ações rápidas</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {data.quickActions.map((a) => (
              <Button key={a.id} variant="outline" size="sm" className="justify-start" onClick={() => go(a.target)}>
                {a.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ---------- KPIs ---------- */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores principais">
        <Kpi label="Contratadas" value={data.kpis.contratadas} Icon={ClipboardCheck} />
        <Kpi label="Realizadas" value={data.kpis.realizadas} Icon={CheckCircle2} />
        <Kpi label="Pendentes" value={data.kpis.pendentes} Icon={Clock} />
        <Kpi label="Cobertura" value={`${data.kpis.coberturaPct}%`} Icon={Gauge} />
        <Kpi label="Lojas sem visita" value={data.kpis.lojasSemVisita} Icon={StoreIcon} onClick={() => go("/?module=audit")} />
        <Kpi label="Indústrias em risco" value={data.kpis.industriasEmRisco} Icon={Factory} onClick={() => go("/?module=audit")} />
      </section>

      {/* ---------- previsão + checklists + qualidade ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Previsão de fechamento</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            <p className="text-xs text-muted-foreground">Projeção com base no ritmo registrado — não é garantia.</p>
            <Row label="Cobertura atual" value={`${data.kpis.coberturaPct}%`} />
            <Row label="Cobertura projetada" value={`${data.forecast.projectedCoveragePct}%`} />
            <Row label="Realizadas projetadas" value={String(data.forecast.projected)} />
            <Row label="Pendentes projetadas" value={String(Math.max(0, -data.forecast.gap))} />
            <Row label="Ritmo recente/dia" value={String(data.forecast.dailyPaceRecent)} />
            <Row label="Ritmo necessário/dia" value={String(data.forecast.requiredDailyPace)} />
            <Row label="Confiança" value={CONFIDENCE_LABEL[data.forecast.confidence] ?? data.forecast.confidence} />
            <p className="mt-1 text-xs text-muted-foreground">
              {data.forecast.daysRemaining} dia(s) restantes no período. Confiança{" "}
              {(CONFIDENCE_LABEL[data.forecast.confidence] ?? "").toLowerCase()} porque o cálculo pondera 60% do ritmo das
              últimas 2 semanas e 40% do ritmo do período.
            </p>
          </CardContent>
        </Card>

        {!isClient && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Checklists e importações</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <Row label="Importações da competência" value={String(data.checklists.imports)} />
              <Row label="Importações com falha" value={String(data.checklists.failedImports)} />
              <Row label="Indústrias sem checklist" value={String(data.checklists.industriesWithoutChecklist)} />
              <Row label="Última importação" value={shortDate(data.checklists.lastImportAt)} />
              {data.viewer.canViewImports && (
                <Button size="sm" variant="outline" className="mt-2 self-start" onClick={() => go("/?module=checklists")}>
                  Abrir Checklists
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Qualidade dos dados</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            <Row label="Abertas" value={String(data.quality.open)} />
            <Row label="Bloqueantes" value={String(data.quality.blocking)} />
            <Row label="Vencidas" value={String(data.quality.overdue)} />
            <Row label="Sem responsável" value={String(data.quality.unassigned)} />
            <Button size="sm" variant="outline" className="mt-2 self-start" onClick={() => go("/?module=quality")}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Abrir Centro de Qualidade
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ---------- indústrias ---------- */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Situação das indústrias</CardTitle></CardHeader>
        <CardContent>
          {data.industries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma indústria no escopo/filtros atuais.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3">Indústria</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3 text-right">Contratadas</th>
                      <th className="py-2 pr-3 text-right">Realizadas</th>
                      <th className="py-2 pr-3 text-right">Cobertura</th>
                      <th className="py-2 pr-3 text-right">Ritmo</th>
                      <th className="py-2 pr-3 text-right">Ocorrências</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.industries.slice(0, 10).map((i) => (
                      <tr
                        key={i.industryId}
                        tabIndex={0}
                        role="button"
                        onClick={() => go(`/?module=audit&industry=${i.industryId}`)}
                        onKeyDown={(e) => e.key === "Enter" && go(`/?module=audit&industry=${i.industryId}`)}
                        className="cursor-pointer border-b border-border/60 outline-none last:border-0 hover:bg-muted/40 focus-visible:bg-muted/60"
                      >
                        <td className="py-2 pr-3 font-medium">{i.industryName}</td>
                        <td className="py-2 pr-3"><Badge variant="outline" className="text-[10px]">{INDUSTRY_STATUS_LABEL[i.status]}</Badge></td>
                        <td className="py-2 pr-3 text-right">{i.contratadas}</td>
                        <td className="py-2 pr-3 text-right">{i.realizadas}</td>
                        <td className="py-2 pr-3 text-right">{i.coberturaPct}%</td>
                        <td className="py-2 pr-3 text-right">{i.pacePercentage}%</td>
                        <td className="py-2 pr-3 text-right">{i.openIssues}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 md:hidden">
                {data.industries.slice(0, 10).map((i) => (
                  <button
                    key={i.industryId}
                    onClick={() => go(`/?module=audit&industry=${i.industryId}`)}
                    className="rounded-lg border border-border/70 p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{i.industryName}</span>
                      <Badge variant="outline" className="text-[10px]">{INDUSTRY_STATUS_LABEL[i.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {i.realizadas}/{i.contratadas} · cobertura {i.coberturaPct}% · ritmo {i.pacePercentage}%
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- tendência ---------- */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Tendência semanal</CardTitle></CardHeader>
        <CardContent className="h-[260px]" aria-label="Gráfico semanal de esperado versus realizado">
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
            <CardHeader className="pb-2"><CardTitle className="text-base">Promotores que exigem atenção</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {data.promoters.length === 0 && <p className="text-muted-foreground">Nenhum promotor em atenção.</p>}
              {data.promoters.map((p) => (
                <div key={p.promoterId} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium"><Users className="mr-1 inline h-4 w-4" aria-hidden />{p.promoterName}</span>
                    <span className="text-xs text-muted-foreground">Última atividade: {shortDate(p.lastVisit)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cobertura {p.coberturaPct}% · {p.pendentes} pendentes · {p.lojasSemVisita} loja(s) sem visita ·{" "}
                    {p.industries.join(", ") || "—"}
                  </p>
                  {p.ambiguousShare > AMBIGUOUS_WARNING_THRESHOLD && (
                    <p className="mt-1 text-xs text-amber-600">
                      Atribuição pouco confiável: {p.ambiguousShare}% das lojas vêm de roteiro ambíguo.
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Supervisores</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.supervisors.available ? (
              <p>Indicador disponível.</p>
            ) : (
              <p>{data.supervisors.reason}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- timeline ---------- */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Linha do tempo</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {data.timeline.length === 0 && <p className="text-muted-foreground">Nenhum evento registrado no escopo atual.</p>}
          {data.timeline.map((e) => (
            <div key={e.id} className="flex items-start gap-3 border-b border-border/50 pb-2 last:border-0">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="truncate">{e.description}</p>
                <p className="text-xs text-muted-foreground">
                  {shortDate(e.at)} {timeOf(e.at)} · {e.kind.replaceAll("_", " ").toLowerCase()}
                  {e.industryName ? ` · ${e.industryName}` : ""}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-right text-[11px] text-muted-foreground">
        Payload gerado em {data.perf.totalMs} ms · {data.perf.queryCount} consultas
      </p>
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
        "rounded-lg border border-border/70 bg-card p-3 text-left",
        onClick && "transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </Comp>
  );
}

function CockpitSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando cockpit">
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
