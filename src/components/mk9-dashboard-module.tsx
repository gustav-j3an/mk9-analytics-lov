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
  ShieldAlert,
  ShieldCheck,
  Search,
} from "lucide-react";
import { DashboardErrorBoundary } from "./mk9/dashboard-error-boundary";
import { MetricCard } from "./mk9-command-center/MetricCard";
import { PerformanceCard } from "./mk9-command-center/PerformanceCard";
import { ChartCard } from "./mk9-command-center/ChartCard";
import { RankingCard } from "./mk9-command-center/RankingCard";
import { IndustryCard as MK9IndustryCard } from "./mk9-command-center/IndustryCard";
import { DashboardHeader } from "./mk9-command-center/DashboardHeader";
import { DashboardHero } from "./mk9-command-center/DashboardHero";

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
import { mk9DashboardOverviewFn, mk9DashboardSupervisorsFn, mk9DashboardCheckIntegrityFn } from "@/lib/mk9-dashboard.functions";

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

  const overviewFn = useServerFn(mk9DashboardOverviewFn);
  const industriesFn = useServerFn(mk9ListIndustries);
  const promotersFn = useServerFn(mk9ListPromoters);
  const supervisorsFn = useServerFn(mk9DashboardSupervisorsFn);

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn(), staleTime: 300000 });
  const promotersQ = useQuery({ queryKey: ["mk9-promoters"], queryFn: () => promotersFn(), staleTime: 300000 });
  const supervisorsQ = useQuery({ queryKey: ["mk9-supervisors"], queryFn: () => supervisorsFn(), staleTime: 300000 });

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
  }, []);

  const filtersNode = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
      <FilterField label="Mês">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-command-deep border-white/10 text-white">
            {MONTHS_PT.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Ano">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-command-deep border-white/10 text-white">
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Indústria">
        <Select value={industryId} onValueChange={setIndustryId}>
          <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-command-deep border-white/10 text-white">
            <SelectItem value={ALL}>Todas as indústrias</SelectItem>
            {(industriesQ.data ?? []).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="UF">
        <Select value={uf} onValueChange={setUf}>
          <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-command-deep border-white/10 text-white">
            <SelectItem value={ALL}>Todas as UFs</SelectItem>
            {(data?.availableUfs ?? []).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Supervisor">
        <Select value={supervisorId} onValueChange={setSupervisorId}>
          <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-command-deep border-white/10 text-white">
            <SelectItem value={ALL}>Todos os supervisores</SelectItem>
            {(supervisorsQ.data ?? []).map((s: any) => <SelectItem key={s.userId} value={s.userId}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Promotor">
        <Select value={promoterId} onValueChange={setPromoterId}>
          <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-command-deep border-white/10 text-white">
            <SelectItem value={ALL}>Todos os promotores</SelectItem>
            {(promotersQ.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-up">
      <DashboardHeader month={month} year={year} />

      {filtersNode}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <PerformanceCard 
            label="Performance Operacional"
            percentage={data?.kpis.coberturaPct ?? 0}
            status={data?.kpis.coberturaPct && data.kpis.coberturaPct > 85 ? "Excelente" : data?.kpis.coberturaPct && data.kpis.coberturaPct > 60 ? "Atenção" : "Crítico"}
            comparison={`vs ${nf(data?.kpis.expectedToDate ?? 0)} esperado`}
          />
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MetricCard color="blue" icon={RouteIcon} label="Visitas Contratadas" value={nf(data?.kpis.contractedTotal ?? 0)} hint={`${nf(data?.kpis.lojasContratadas ?? 0)} lojas no escopo`} onClick={() => drill({})} />
          <MetricCard color="emerald" icon={CheckCircle2} label="Visitas Realizadas" value={nf(data?.kpis.realizedToDate ?? 0)} hint={`${data?.kpis.coberturaPct}% de execução`} onClick={() => drill({})} />
          <MetricCard color="amber" icon={AlertTriangle} label="Pendências" value={nf(data?.kpis.pendentes ?? 0)} hint="Aguardando execução" onClick={() => drill({})} />
          <MetricCard color="cyan" icon={Gauge} label="Cobertura Geral" value={`${data?.kpis.coberturaPct ?? 0}%`} hint="Status de entrega" onClick={() => drill({})} />
          <MetricCard color="purple" icon={Users} label="Promotores Ativos" value={nf(promotersQ.data?.length ?? 0)} hint="Efetivo em campo" onClick={() => drill({})} />
          <MetricCard color="rose" icon={Factory} label="Indústrias Risco" value={nf(data?.kpis.industriasEmRisco ?? 0)} hint="Atenção imediata" onClick={() => drill({})} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Evolução do Período" subtitle="Esperado vs Realizado acumulado">
          {loading || !data ? <Skeleton className="h-full w-full rounded-lg" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(8) + "/" + v.slice(5, 7)} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94A3B8" }} width={30} />
                <RTooltip 
                  contentStyle={{ backgroundColor: "#111122", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "#94A3B8" }}
                  itemStyle={{ fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="expected" stroke="#A855F7" fillOpacity={1} fill="url(#colorExp)" strokeWidth={2} />
                <Area type="monotone" dataKey="realized" stroke="#3B82F6" fillOpacity={1} fill="url(#colorReal)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Execução Semanal" subtitle="Percentual de entrega por semana">
          {loading || !data ? <Skeleton className="h-full w-full rounded-lg" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.industryStatusDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94A3B8" }} width={30} />
                <RTooltip 
                   contentStyle={{ backgroundColor: "#111122", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.industryStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#A855F7" : "#3B82F6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MK9IndustryCard industries={(data?.industries ?? []).slice(0, 6).map(i => ({
          name: i.industryName,
          percentage: i.coberturaPct,
          visits: i.realizadas,
          status: i.coberturaPct > 85 ? "Excelente" : i.coberturaPct > 60 ? "Atenção" : "Crítico"
        }))} />
        
        <RankingCard items={(promotersQ.data ?? []).slice(0, 5).map((p: any, idx: number) => ({
          position: idx + 1,
          name: p.name,
          id: p.id,
          visits: 0, // Mock, needs real logic if available
          score: 0 // Mock, needs real logic if available
        }))} />
      </div>

      {/* Tabela legada escondida ou em drawer para manter funcionalidade original sem quebrar visual */}
      <div className="opacity-0 h-0 overflow-hidden">
        <DashboardIntegrityCheck params={params} />
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-3 rounded-full bg-muted/50 p-3">
        <Info className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function DashboardIntegrityCheck({ params }: { params: any }) {
  const checkFn = useServerFn(mk9DashboardCheckIntegrityFn);
  const [open, setOpen] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mk9-dashboard-integrity", params],
    queryFn: () => checkFn({ data: params }),
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-2 text-muted-foreground hover:text-primary">
          <ShieldAlert className="h-4 w-4" />
          <span className="hidden sm:inline">Integridade</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md bg-command-deep text-white border-white/10">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5 text-command-purple" />
            Diagnóstico de Integridade
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="text-sm text-muted-foreground">
            Varredura em tempo real para detectar inconsistências que podem afetar os indicadores.
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-command-purple/30" />
              <p className="text-xs text-muted-foreground">Analisando base de dados...</p>
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className={cn(
                "p-4 rounded-xl border flex items-center gap-3",
                data.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              )}>
                {data.ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <div>
                  <p className="font-semibold text-sm">{data.ok ? "Sistema Saudável" : "Atenção Requerida"}</p>
                  <p className="text-xs opacity-80">{data.ok ? "Nenhuma inconsistência crítica detectada." : `${data.issues.length} item(s) para revisão.`}</p>
                </div>
              </div>

              <div className="space-y-3">
                {data.issues.map((issue: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant={issue.severity === "ERROR" ? "destructive" : "outline"} className="text-[10px] h-4 px-1">
                        {issue.kind}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{issue.severity}</span>
                    </div>
                    <p className="text-xs">{issue.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Button 
            className="w-full bg-command-purple hover:bg-command-purple/80 text-white" 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Nova Varredura
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
