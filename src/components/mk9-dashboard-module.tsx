import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  Filter,
  Gauge,
  Info,
  RefreshCw,
  Route as RouteIcon,
  Store as StoreIcon,
  TrendingDown,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { mk9ListIndustries, mk9ListPromoters } from "@/lib/mk9-data.functions";
import { mk9DashboardOverviewFn, mk9DashboardSupervisorsFn } from "@/lib/mk9-dashboard.functions";
import {
  INDUSTRY_STATUS_LABEL,
  type DashboardAlert,
  type DashboardIndustryRow,
  type DashboardOverview,
  type IndustryStatusKey,
} from "@/lib/mk9-dashboard/types";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ALL = "__ALL__";

export interface DashboardDrillDown {
  month: number;
  year: number;
  industryId?: string | null;
  uf?: string | null;
  promoterId?: string | null;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return d && m && y ? `${d}/${m}/${y}` : v;
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}
function nf(v: number) {
  return new Intl.NumberFormat("pt-BR").format(v);
}

const STATUS_STYLES: Record<IndustryStatusKey, string> = {
  CONCLUIDA: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  EM_DIA: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  ATENCAO: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  CRITICA: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  SEM_CHECKLIST: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  SEM_FREQUENCIA: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};
const STATUS_CHART_COLOR: Record<IndustryStatusKey, string> = {
  CONCLUIDA: "#34d399",
  EM_DIA: "#38bdf8",
  ATENCAO: "#fbbf24",
  CRITICA: "#fb7185",
  SEM_CHECKLIST: "#a78bfa",
  SEM_FREQUENCIA: "#a1a1aa",
};
const SEVERITY_STYLES: Record<DashboardAlert["severity"], string> = {
  CRITICA: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  ALTA: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  MEDIA: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  BAIXA: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

export function Mk9DashboardModule({ onDrillDown }: { onDrillDown?: (f: DashboardDrillDown) => void }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [industryId, setIndustryId] = useState(ALL);
  const [uf, setUf] = useState(ALL);
  const [supervisorId, setSupervisorId] = useState(ALL);
  const [promoterId, setPromoterId] = useState(ALL);
  const [showAllStores, setShowAllStores] = useState(false);

  const overviewFn = useServerFn(mk9DashboardOverviewFn);
  const industriesFn = useServerFn(mk9ListIndustries);
  const promotersFn = useServerFn(mk9ListPromoters);
  const supervisorsFn = useServerFn(mk9DashboardSupervisorsFn);

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn(), staleTime: 300000 });
  const promotersQ = useQuery({ queryKey: ["mk9-promoters"], queryFn: () => promotersFn(), staleTime: 300000 });
  const supervisorsQ = useQuery({ queryKey: ["mk9-supervisors"], queryFn: () => supervisorsFn(), staleTime: 300000 });

  // Cache por combinação de filtros: mês + ano + indústria + UF + supervisor + promotor.
  const params = {
    year, month,
    industryId: industryId === ALL ? null : industryId,
    uf: uf === ALL ? null : uf,
    promoterId: promoterId === ALL ? null : promoterId,
    supervisorUserId: supervisorId === ALL ? null : supervisorId,
  };
  const overviewQ = useQuery({
    queryKey: ["mk9-dashboard", params.year, params.month, params.industryId, params.uf, params.supervisorUserId, params.promoterId],
    queryFn: () => overviewFn({ data: params }),
    staleTime: 60000,
    placeholderData: (prev) => prev,
  });

  const data = overviewQ.data as DashboardOverview | undefined;
  const loading = overviewQ.isLoading;

  const drill = (f: Partial<DashboardDrillDown>) =>
    onDrillDown?.({
      month, year,
      industryId: f.industryId ?? (industryId === ALL ? null : industryId),
      uf: f.uf ?? (uf === ALL ? null : uf),
      promoterId: f.promoterId ?? (promoterId === ALL ? null : promoterId),
    });

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now.getFullYear()]);

  const filtersNode = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <FilterField label="Mês">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS_PT.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Ano">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Indústria">
        <Select value={industryId} onValueChange={setIndustryId}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as indústrias</SelectItem>
            {(industriesQ.data ?? []).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="UF">
        <Select value={uf} onValueChange={setUf}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as UFs</SelectItem>
            {(data?.availableUfs ?? []).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Supervisor">
        <Select value={supervisorId} onValueChange={setSupervisorId}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os supervisores</SelectItem>
            {(supervisorsQ.data ?? []).map((s: any) => <SelectItem key={s.userId} value={s.userId}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Promotor">
        <Select value={promoterId} onValueChange={setPromoterId}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os promotores</SelectItem>
            {(promotersQ.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* -------- Cabeçalho + filtros globais -------- */}
      <Card className="border-border/70 shadow-[var(--shadow-soft)]">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Painel operacional</CardTitle>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />
                {data ? `${data.periodLabel} · ${fmtDate(data.windowStart)} a ${fmtDate(data.windowEnd)}` : "—"}
              </span>
              <span className="inline-flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" />
                {data ? `${data.checklistImports} checklist(s) importado(s)` : "—"}
              </span>
              <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" />
                {data ? `Atualizado em ${fmtDateTime(data.generatedAt)}` : "—"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => overviewQ.refetch()} disabled={overviewQ.isFetching}>
              <RefreshCw className={cn("h-4 w-4", overviewQ.isFetching && "animate-spin")} /> Atualizar
            </Button>
            {/* filtros em drawer no mobile */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary" size="sm" className="h-9"><Filter className="h-4 w-4" /> Filtros</Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                  <SheetHeader><SheetTitle>Filtros do dashboard</SheetTitle></SheetHeader>
                  <div className="p-4">{filtersNode}</div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </CardHeader>
        <CardContent className="hidden lg:block">{filtersNode}</CardContent>
      </Card>


      {/* -------- KPIs -------- */}
      {loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[122px] rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            icon={RouteIcon} tone="blue" label="Visitas contratadas" value={nf(data.kpis.contractedTotal)}
            hint={`${nf(data.kpis.lojasContratadas)} lojas com frequência`}
            meta={`Meta até hoje: ${nf(data.kpis.expectedToDate)}`}
            onClick={() => drill({})}
          />
          <Kpi
            icon={CheckCircle2} tone="green" label="Visitas realizadas" value={nf(data.kpis.realizedToDate)}
            hint={`${data.kpis.coberturaPct}% do contratado · ${nf(data.kpis.extras)} extras`}
            meta={`${data.kpis.deviation >= 0 ? "+" : ""}${nf(data.kpis.deviation)} vs meta até hoje`}
            trend={data.kpis.deviation >= 0 ? "up" : "down"}
            onClick={() => drill({})}
          />
          <Kpi
            icon={AlertTriangle} tone="amber" label="Visitas pendentes" value={nf(data.kpis.pendentes)}
            hint={`${100 - data.kpis.coberturaPct}% do contrato em aberto`}
            meta={`Ritmo atual: ${data.kpis.pacePercentage}% do esperado`}
            trend={data.kpis.pacePercentage >= 100 ? "up" : "down"}
            onClick={() => drill({})}
          />
          <Kpi
            icon={Gauge} tone="violet" label="Cobertura geral" value={`${data.kpis.coberturaPct}%`}
            hint={`${nf(data.kpis.realizedToDate)} de ${nf(data.kpis.contractedTotal)}`}
            meta={`Esperado até hoje: ${data.kpis.contractedTotal > 0 ? Math.round((data.kpis.expectedToDate / data.kpis.contractedTotal) * 100) : 0}%`}
            progress={data.kpis.coberturaPct}
            onClick={() => drill({})}
          />
          <Kpi
            icon={StoreIcon} tone="green" label="Lojas atendidas" value={nf(data.kpis.lojasAtendidas)}
            hint={`de ${nf(data.kpis.lojasContratadas)} lojas contratadas`}
            meta={`${data.kpis.lojasContratadas > 0 ? Math.round((data.kpis.lojasAtendidas / data.kpis.lojasContratadas) * 100) : 0}% da base atendida`}
            onClick={() => drill({})}
          />
          <Kpi
            icon={UserX} tone="amber" label="Lojas sem visita" value={nf(data.kpis.lojasSemVisita)}
            hint="Contratadas e ainda sem nenhuma execução"
            meta={data.kpis.lojasSemVisita > 0 ? "Requer ação imediata" : "Nenhuma pendência"}
            trend={data.kpis.lojasSemVisita > 0 ? "down" : "up"}
            onClick={() => drill({})}
          />
          <Kpi
            icon={Factory} tone="rose" label="Indústrias em risco" value={nf(data.kpis.industriasEmRisco)}
            hint={`de ${nf(data.kpis.industriasTotal)} indústrias no escopo`}
            meta="Crítica, atenção, sem checklist ou sem frequência"
            trend={data.kpis.industriasEmRisco > 0 ? "down" : "up"}
            onClick={() => drill({})}
          />
          <Kpi
            icon={Users} tone="blue" label="Visitas sem promotor" value={nf(data.kpis.visitasSemPromotor)}
            hint="Roteiro não resolvido (ausente ou ambíguo)"
            meta="Continuam contando para indústria e loja"
            onClick={() => drill({})}
          />
        </div>
      )}

      {/* -------- Evolução + alertas -------- */}
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução do período</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Meta contratada distribuída proporcionalmente × execução acumulada do checklist
            </p>
          </CardHeader>
          <CardContent className="h-[320px]">
            {loading || !data ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : data.series.length === 0 ? (
              <Empty message="Sem período configurado para o filtro atual." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v) => v.slice(8) + "/" + v.slice(5, 7)} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={36} />
                  <RTooltip
                    contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }}
                    labelFormatter={(v) => fmtDate(String(v))}
                    formatter={(value: any, name: any, item: any) => {
                      if (name === "realized") {
                        const d = Number(item?.payload?.diff ?? 0);
                        return [`${nf(Number(value))}  (${d >= 0 ? "+" : ""}${nf(d)})`, "Realizado acumulado"];
                      }
                      return [nf(Number(value)), "Esperado acumulado"];
                    }}
                  />
                  <Legend verticalAlign="top" height={28} formatter={(v) => (v === "expected" ? "Esperado" : v === "realized" ? "Realizado" : "Diferença")} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="expected" stroke="var(--color-chart-1)" strokeWidth={2} strokeDasharray="5 4" fill="url(#dExp)" />
                  <Area type="monotone" dataKey="realized" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#dReal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">O que precisa de atenção</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data ? `${data.alertsTotal} alertas · exibindo ${data.alerts.length}` : "—"}
              </p>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {loading || !data ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
            ) : data.alerts.length === 0 ? (
              <Empty message="Nenhum alerta operacional no período." />
            ) : (
              data.alerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => drill({ industryId: a.industryId, uf: a.uf, promoterId: a.promoterId })}
                  className="group flex w-full items-start gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <span className={cn("mt-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", SEVERITY_STYLES[a.severity])}>
                    {a.severity}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.description}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* -------- Status por indústria -------- */}
      <Card className="border-border/70 shadow-[var(--shadow-soft)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status por indústria</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Ordenado por severidade. Clique para abrir a Auditoria de Execução.</p>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {loading || !data ? (
            <div className="space-y-2 px-6 sm:px-0">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-md" />)}</div>
          ) : data.industries.length === 0 ? (
            <Empty message="Nenhuma indústria no escopo selecionado." />
          ) : (
            <>
              {/* desktop */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indústria</TableHead>
                      <TableHead className="text-right">Lojas contr.</TableHead>
                      <TableHead className="text-right">Lojas atend.</TableHead>
                      <TableHead className="text-right">Contratadas</TableHead>
                      <TableHead className="text-right">Esperado hoje</TableHead>
                      <TableHead className="text-right">Realizadas</TableHead>
                      <TableHead className="text-right">Pendentes</TableHead>
                      <TableHead className="text-right">Cobertura</TableHead>
                      <TableHead className="text-right">Desvio</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.industries.map((i) => (
                      <TableRow key={i.industryId} className="cursor-pointer" onClick={() => drill({ industryId: i.industryId })}>
                        <TableCell className="font-medium">
                          {i.industryName}
                          <span className="ml-2 text-[11px] text-muted-foreground">{fmtDate(i.windowStart)}–{fmtDate(i.windowEnd)}</span>
                        </TableCell>
                        <TableCell className="text-right">{nf(i.lojasContratadas)}</TableCell>
                        <TableCell className="text-right">{nf(i.lojasAtendidas)}</TableCell>
                        <TableCell className="text-right">{nf(i.contratadas)}</TableCell>
                        <TableCell className="text-right">{nf(i.expectedToDate)}</TableCell>
                        <TableCell className="text-right font-medium">{nf(i.realizadas)}</TableCell>
                        <TableCell className="text-right">{nf(i.pendentes)}</TableCell>
                        <TableCell className="text-right">{i.coberturaPct}%</TableCell>
                        <TableCell className={cn("text-right font-medium", i.deviation >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                          {i.deviation >= 0 ? "+" : ""}{nf(i.deviation)}
                        </TableCell>
                        <TableCell><StatusBadge status={i.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* mobile / tablet: lista */}
              <div className="space-y-2 px-4 md:hidden">
                {data.industries.map((i) => <IndustryCard key={i.industryId} row={i} onOpen={() => drill({ industryId: i.industryId })} />)}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* -------- Gráficos de distribuição -------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-2"><CardTitle className="text-base">Lojas por execução</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {loading || !data ? <Skeleton className="h-full w-full rounded-lg" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RTooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }} />
                  <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11 }} />
                  <Pie data={data.storeExecutionDistribution} dataKey="value" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={3} stroke="var(--color-card)" strokeWidth={3}>
                    {data.storeExecutionDistribution.map((d) => (
                      <Cell key={d.key} fill={d.key === "INTEGRAL" ? "#34d399" : d.key === "PARCIAL" ? "#fbbf24" : "#fb7185"} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-2"><CardTitle className="text-base">Indústrias por status</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {loading || !data ? <Skeleton className="h-full w-full rounded-lg" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.industryStatusDistribution} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={28} />
                  <RTooltip cursor={{ fill: "var(--color-accent)", opacity: 0.4 }} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {data.industryStatusDistribution.map((d) => <Cell key={d.key} fill={STATUS_CHART_COLOR[d.key]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* -------- Lojas críticas -------- */}
      <Card className="border-border/70 shadow-[var(--shadow-soft)]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Lojas críticas</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data ? `${data.criticalStoresTotal} lojas com pendência · exibindo ${showAllStores ? data.criticalStores.length : Math.min(6, data.criticalStores.length)}` : "—"}
            </p>
          </div>
          {data && data.criticalStoresTotal > 0 && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => (showAllStores ? drill({}) : setShowAllStores(true))}>
              {showAllStores ? "Ver todas na Auditoria" : "Ver todas"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {loading || !data ? (
            <div className="space-y-2 px-6 sm:px-0">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-md" />)}</div>
          ) : data.criticalStores.length === 0 ? (
            <Empty message="Nenhuma loja crítica no período." />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loja</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Indústria</TableHead>
                      <TableHead className="text-right">Freq. sem/mês</TableHead>
                      <TableHead className="text-right">Contr.</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Realiz.</TableHead>
                      <TableHead className="text-right">Pend.</TableHead>
                      <TableHead>Última visita</TableHead>
                      <TableHead className="text-right">Dias s/ visita</TableHead>
                      <TableHead>Promotor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(showAllStores ? data.criticalStores : data.criticalStores.slice(0, 6)).map((s) => (
                      <TableRow key={`${s.industryId}-${s.storeId}`} className="cursor-pointer" onClick={() => drill({ industryId: s.industryId, uf: s.uf })}>
                        <TableCell className="max-w-[260px] font-medium">{s.storeName}</TableCell>
                        <TableCell>{s.uf ?? "—"}</TableCell>
                        <TableCell>{s.industryName}</TableCell>
                        <TableCell className="text-right">{s.weeklyFrequency ?? "—"} / {s.monthlyFrequency ?? "—"}</TableCell>
                        <TableCell className="text-right">{nf(s.contratadas)}</TableCell>
                        <TableCell className="text-right">{nf(s.expectedToDate)}</TableCell>
                        <TableCell className="text-right font-medium">{nf(s.realizadas)}</TableCell>
                        <TableCell className="text-right">{nf(s.pendentes)}</TableCell>
                        <TableCell>{fmtDate(s.lastVisit)}</TableCell>
                        <TableCell className="text-right">{s.daysWithoutVisit ?? "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate">
                          {s.promoterResolution === "MATCHED_ROUTE" ? s.promoterName
                            : s.promoterResolution === "AMBIGUOUS_ROUTE" ? "Ambíguo" : "Sem roteiro"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px]",
                            s.status === "INTEGRAL" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : s.status === "PARCIAL" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30")}>
                            {s.status === "INTEGRAL" ? "Integral" : s.status === "PARCIAL" ? "Parcial" : "Não atendida"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 px-4 lg:hidden">
                {(showAllStores ? data.criticalStores : data.criticalStores.slice(0, 6)).map((s) => (
                  <button
                    key={`${s.industryId}-${s.storeId}`}
                    onClick={() => drill({ industryId: s.industryId, uf: s.uf })}
                    className="w-full rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{s.storeName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{s.uf ?? "—"}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.industryName} · {s.realizadas}/{s.contratadas} realizadas · {s.pendentes} pendentes
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Última visita {fmtDate(s.lastVisit)} · {s.daysWithoutVisit ?? "—"} dias
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* -------- Promotores -------- */}
      <Card className="border-border/70 shadow-[var(--shadow-soft)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status dos promotores</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Promotor resolvido pelo roteiro vigente. Visitas ambíguas ou sem roteiro aparecem em linhas próprias.
          </p>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {loading || !data ? (
            <div className="space-y-2 px-6 sm:px-0">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-md" />)}</div>
          ) : data.promoters.length === 0 ? (
            <Empty message="Sem promotores no escopo." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Promotor</TableHead>
                    <TableHead className="text-right">Lojas</TableHead>
                    <TableHead className="text-right">Indústrias</TableHead>
                    <TableHead className="text-right">Esperado hoje</TableHead>
                    <TableHead className="text-right">Realizadas</TableHead>
                    <TableHead className="text-right">Cobertura</TableHead>
                    <TableHead className="text-right">Lojas s/ visita</TableHead>
                    <TableHead className="text-right">Fora do dia</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.promoters.slice(0, 12).map((p) => (
                    <TableRow key={p.promoterId ?? p.promoterName} className={p.promoterId ? "cursor-pointer" : ""} onClick={() => p.promoterId && drill({ promoterId: p.promoterId })}>
                      <TableCell className="font-medium">{p.promoterName}</TableCell>
                      <TableCell className="text-right">{nf(p.storesCount)}</TableCell>
                      <TableCell className="text-right">{nf(p.industriesCount)}</TableCell>
                      <TableCell className="text-right">{nf(p.expectedToDate)}</TableCell>
                      <TableCell className="text-right font-medium">{nf(p.realizadas)}</TableCell>
                      <TableCell className="text-right">{p.coberturaPct}%</TableCell>
                      <TableCell className="text-right">{nf(p.storesWithoutVisit)}</TableCell>
                      <TableCell className="text-right">{nf(p.visitsOffSchedule)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]",
                          p.status === "EM_DIA" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : p.status === "ATENCAO" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : p.status === "CRITICA" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30")}>
                          {p.status === "EM_DIA" ? "Em dia" : p.status === "ATENCAO" ? "Atenção" : p.status === "CRITICA" ? "Crítica" : "Não resolvido"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const KPI_TONES = {
  blue: "from-sky-500/15 to-transparent",
  green: "from-emerald-500/15 to-transparent",
  amber: "from-amber-500/15 to-transparent",
  violet: "from-violet-500/15 to-transparent",
  rose: "from-rose-500/15 to-transparent",
} as const;
const KPI_ICON_TONES = {
  blue: "text-sky-600 dark:text-sky-300",
  green: "text-emerald-600 dark:text-emerald-300",
  amber: "text-amber-600 dark:text-amber-300",
  violet: "text-violet-600 dark:text-violet-300",
  rose: "text-rose-600 dark:text-rose-300",
} as const;

function Kpi({
  icon: Icon, label, value, hint, meta, tone = "blue", trend, progress, onClick,
}: {
  icon: typeof Gauge; label: string; value: string; hint: string; meta: string;
  tone?: keyof typeof KPI_TONES; trend?: "up" | "down"; progress?: number; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-left shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70", KPI_TONES[tone])} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Icon className={cn("h-4 w-4", KPI_ICON_TONES[tone])} />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          {trend && (trend === "up"
            ? <TrendingUp className="h-4 w-4 text-emerald-400" />
            : <TrendingDown className="h-4 w-4 text-rose-400" />)}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        {typeof progress === "number" && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}
        <p className="mt-2 truncate text-[11px] text-muted-foreground/80">{meta}</p>
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: IndustryStatusKey }) {
  return <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLES[status])}>{INDUSTRY_STATUS_LABEL[status]}</Badge>;
}

function IndustryCard({ row, onOpen }: { row: DashboardIndustryRow; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="w-full rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{row.industryName}</span>
        <StatusBadge status={row.status} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {nf(row.realizadas)} de {nf(row.contratadas)} contratadas · esperado {nf(row.expectedToDate)} · {row.coberturaPct}%
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {row.lojasAtendidas}/{row.lojasContratadas} lojas · desvio {row.deviation >= 0 ? "+" : ""}{nf(row.deviation)}
      </div>
    </button>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="grid h-full min-h-[120px] place-items-center px-6 text-sm text-muted-foreground">{message}</div>;
}
