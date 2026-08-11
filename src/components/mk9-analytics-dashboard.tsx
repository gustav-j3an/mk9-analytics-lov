import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  LayoutDashboard,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  Zap,
  Database,
  Cpu,
  History,
  TrendingDown,
  Target,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercentage } from "@/lib/mk9/normalization";
import { Mk9Panel, Mk9Badge, Mk9LoadingState, Mk9ErrorState } from "./mk9/design-system";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AnalyticsMetricCard, AnalyticsChartCard, AnalyticsTable } from "./mk9/AnalyticsComponents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getMk9AnalyticsDashboardFn } from "@/lib/mk9-analytics/analytics.functions";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";

const MONTHS_PT = [
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

function nf(v: number) {
  return new Intl.NumberFormat("pt-BR").format(v);
}

export function Mk9AnalyticsDashboard({ initialMonth, initialYear }: { initialMonth?: number; initialYear?: number }) {
  const [month, setMonth] = useState(initialMonth || new Date().getMonth() + 1);
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const [industryId, setIndustryId] = useState("__ALL__");
  const [uf, setUf] = useState("__ALL__");
  const [matrixCollapsed, setMatrixCollapsed] = useState(true);

  const analyticsFn = useServerFn(getMk9AnalyticsDashboardFn);
  const industriesFn = useServerFn(mk9ListIndustries);

  useEffect(() => {
    if (initialMonth) setMonth(initialMonth);
  }, [initialMonth]);

  useEffect(() => {
    if (initialYear) setYear(initialYear);
  }, [initialYear]);

  const industriesQ = useQuery({
    queryKey: ["mk9-industries-list"],
    queryFn: () => industriesFn(),
    staleTime: 300000,
  });

  const params = {
    year,
    month,
    industryId: industryId === "__ALL__" ? null : industryId,
    uf: uf === "__ALL__" ? null : uf,
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["mk9-analytics-data", year, month, industryId, uf],
    queryFn: () => analyticsFn({ data: params }),
    staleTime: 60000,
  });

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  if (isLoading) return <Mk9LoadingState message="Inicializando Comando Analítico..." />;
  if (error)
    return <Mk9ErrorState message="Erro ao carregar matriz analítica." onRetry={() => refetch()} />;
  if (!data)
    return (
      <Mk9ErrorState message="Nenhum dado retornado para este período." onRetry={() => refetch()} />
    );

  const {
    executive: rawExecutive,
    industries = [],
    ufs = [],
    frequencies = [],
    matrix = [],
    projection: rawProjection,
    topPriorities = [],
    lastUpdate,
  } = data;

  // HOTFIX v1.0.2: Normalização robusta para evitar crashes de undefined (.coverage, .riskStatus, etc)
  const executive = {
    coverage: rawExecutive?.coverage ?? { current: 0, previous: 0, delta: 0, percentChange: 0 },
    pending: rawExecutive?.pending ?? { current: 0, previous: 0, delta: 0, percentChange: 0 },
    extras: rawExecutive?.extras ?? { current: 0 },
    zeroVisits: rawExecutive?.zeroVisits ?? { current: 0, previous: 0, delta: 0, percentChange: 0 },
    contracted: rawExecutive?.contracted ?? { current: 0, previous: 0, delta: 0, percentChange: 0 },
    realized: rawExecutive?.realized ?? { current: 0, previous: 0, delta: 0, percentChange: 0 },
  };

  const projection = {
    realized: rawProjection?.realized ?? 0,
    projected: rawProjection?.projected ?? 0,
    contracted: rawProjection?.contracted ?? 0,
    riskStatus: (rawProjection?.riskStatus ?? "N/D") as string,
    daysRemaining: rawProjection?.daysRemaining ?? 0,
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20 selection:bg-purple-500/30">
      {/* Performance Debug (Visible in Dev) */}
      {data.perf && (
        <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground uppercase tracking-widest border-b border-border/50 pb-2 mb-4">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-500" /> Core: {data.perf.coreMs}ms
          </span>
          <span className="flex items-center gap-1">
            <Database className="h-3 w-3 text-blue-500" /> Queries: {data.perf.queryCount}
          </span>
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3 text-purple-500" /> Payload: Consolidade
          </span>
        </div>
      )}

      {/* Visão de Risco, Projeção e Monitoramento (Executive View) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-command p-4 rounded-2xl border border-border/50 bg-card/50 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Indústrias Monitoradas
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="bg-popover border-border text-foreground text-[10px] max-w-[200px]">
                  {data.perf?.monitoredWithChecklistCount ?? 0} importadas · {data.perf?.monitoredPendingChecklistCount ?? 0} pendentes de checklist.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground italic">
              {data.perf?.monitoredIndustriesCount ?? 0}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              DE {industries.length}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "glass-command p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300",
            projection?.riskStatus === "CRITICAL"
              ? "border-rose-500/30 bg-rose-500/10 glow-rose shadow-[0_0_20px_rgba(244,63,94,0.1)]"
              : "border-border/50 bg-card/50",
          )}
        >
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
            Status de Risco
          </span>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-3 w-3 rounded-full animate-pulse",
                projection?.riskStatus === "CRITICAL"
                  ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                  : projection?.riskStatus === "HIGH"
                    ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                    : "bg-emerald-500",
              )}
            />
            <span
              className={cn(
                "text-xl font-black italic uppercase",
                projection?.riskStatus === "CRITICAL" ? "text-rose-500" : "text-foreground",
              )}
            >
              {projection?.riskStatus || "N/D"}
            </span>
          </div>
        </div>

        <div className="glass-command p-4 rounded-2xl border border-border/50 bg-card/50 flex flex-col justify-between">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
            Projeção Final
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground italic">
              {nf(projection.projected)}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              vs {nf(projection.contracted)}
            </span>
          </div>
        </div>

        <div className="glass-command p-4 rounded-2xl border border-border/50 bg-card/50 flex flex-col justify-between">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
            Meta Proporcional
          </span>
          <div className="flex flex-col">
            <div className="flex justify-between items-end mb-1">
              <span className="text-lg font-black text-foreground italic">
                {rawExecutive?.coverage ? formatPercentage(executive.coverage.current) : "N/D"}
              </span>
              <span className="text-[9px] font-bold text-muted-foreground">
                FALTAM {nf(executive.pending.current)}
              </span>
            </div>

            <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${executive.coverage.current}%` }}
              />
            </div>
          </div>
        </div>

        <div className="glass-command p-4 rounded-2xl border border-border/50 bg-card/50 flex flex-col justify-between">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
            Última Atualização
          </span>
          <div className="flex items-center gap-2 text-foreground/70">
            <Clock className="h-4 w-4 text-command-purple" />
            <span className="text-xs font-bold uppercase">
              {lastUpdate ? new Date(lastUpdate).toLocaleTimeString("pt-BR") : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tighter uppercase italic logo-mk9-text">
              MK9 <span className="text-command-purple">ANALYTICS</span>
            </h1>
          </div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] ml-5">
            Inteligência Operacional · V1.3.5
          </p>

        </div>

        <div className="glass-command p-1.5 md:p-2 rounded-2xl flex flex-wrap items-center gap-1.5 md:gap-2 border border-border/50">
          <div className="flex items-center gap-2 px-2 border-r border-border/50 mr-2 hidden sm:flex">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
              Filtros
            </span>
          </div>

          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-8 min-w-[110px] md:min-w-[130px] bg-input/50 border-border/50 text-[9px] md:text-[10px] font-bold text-foreground uppercase tracking-wider px-2 md:px-3 gap-1 md:gap-2 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-foreground">
              {MONTHS_PT.map((m, i) => (
                <SelectItem
                  key={m}
                  value={String(i + 1)}
                  className="text-[10px] font-bold uppercase"
                >
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-8 min-w-[70px] md:min-w-[90px] bg-input/50 border-border/50 text-[9px] md:text-[10px] font-bold text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-foreground">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-[10px] font-bold">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={industryId} onValueChange={setIndustryId}>
            <SelectTrigger className="h-8 min-w-[140px] md:min-w-[160px] bg-input/50 border-border/50 text-[9px] md:text-[10px] font-bold text-foreground uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-foreground">
              <SelectItem value="__ALL__" className="text-[10px] font-bold uppercase">
                Todas as Indústrias
              </SelectItem>
              {(industriesQ.data ?? []).map((i: any) => (
                <SelectItem key={i.id} value={i.id} className="text-[10px] font-bold uppercase">
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger className="h-8 min-w-[60px] md:min-w-[80px] bg-input/50 border-border/50 text-[9px] md:text-[10px] font-bold text-foreground uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-foreground">
              <SelectItem value="__ALL__" className="text-[10px] font-bold uppercase">
                UF
              </SelectItem>
              {[
                "AC",
                "AL",
                "AP",
                "AM",
                "BA",
                "CE",
                "DF",
                "ES",
                "GO",
                "MA",
                "MT",
                "MS",
                "MG",
                "PA",
                "PB",
                "PR",
                "PE",
                "PI",
                "RJ",
                "RN",
                "RS",
                "RO",
                "RR",
                "SC",
                "SP",
                "SE",
                "TO",
              ].map((u) => (
                <SelectItem key={u} value={u} className="text-[10px] font-bold">
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/30"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Top 3 Prioridades Críticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {topPriorities.slice(0, 3).map((p) => (
          <div
            key={`${p.storeId}-${p.industryName}`}
            className="glass-command p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <Mk9Badge variant="danger" className="text-[8px]">
                PRIORIDADE {p.score}
              </Mk9Badge>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
            <span className="text-xs font-black text-foreground uppercase tracking-tighter truncate">
              {p.storeName}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1">{p.reason}</span>
          </div>
        ))}
      </div>

      {/* Main KPIs Row */}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <AnalyticsMetricCard
          label="Visitas Contratadas"
          value={nf(executive.contracted.current)}
          icon={Activity}
          color="blue"
          hint="Detalhamento por Indústria"
          onClick={() => {
            const el = document.getElementById("industry-analysis");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          comparison={{
            value: executive.contracted.previous,
            label: "anterior",
            trend: executive.contracted.delta >= 0 ? "up" : "down",
            percentChange: executive.contracted.percentChange,
          }}
        />
        <AnalyticsMetricCard
          label="Visitas Realizadas"
          value={nf(executive.realized.current)}
          icon={CheckCircle2}
          color="emerald"
          hint="Detalhamento por Indústria"
          onClick={() => {
            const el = document.getElementById("industry-analysis");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          comparison={{
            value: executive.realized.previous,
            label: "anterior",
            trend: executive.realized.delta >= 0 ? "up" : "down",
            percentChange: executive.realized.percentChange,
          }}
        />
        <AnalyticsMetricCard
          label="Visitas Pendentes"
          value={nf(executive.pending.current)}
          icon={Clock}
          color="amber"
          comparison={{
            value: executive.pending.previous,
            label: "anterior",
            trend: executive.pending.delta <= 0 ? "up" : "down",
            percentChange: executive.pending.percentChange,
          }}
        />
        <AnalyticsMetricCard
          label="Extras Realizadas"
          value={nf(executive.extras.current)}
          icon={TrendingUp}
          color="purple"
        />
        <AnalyticsMetricCard
          label="Cobertura Geral"
          value={rawExecutive?.coverage ? formatPercentage(executive.coverage.current) : "N/D"}
          icon={Activity}
          color="cyan"
          comparison={rawExecutive?.coverage ? {
            value: executive.coverage.previous,
            label: "anterior",
            trend: executive.coverage.delta >= 0 ? "up" : "down",
            percentChange: executive.coverage.delta,
          } : undefined}
        />
        <AnalyticsMetricCard
          label="Lojas Zero Visitas"
          value={nf(executive.zeroVisits.current)}
          icon={AlertTriangle}
          color="rose"
          comparison={{
            value: executive.zeroVisits.previous,
            label: "anterior",
            trend: executive.zeroVisits.delta <= 0 ? "up" : "down",
            percentChange: executive.zeroVisits.percentChange,
          }}
        />
      </div>

      {/* Charts & Matrix Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <AnalyticsChartCard
          title={
            <div 
              className="flex items-center justify-between w-full cursor-pointer group/title"
              onClick={() => setMatrixCollapsed(!matrixCollapsed)}
              role="button"
              aria-expanded={!matrixCollapsed}
              aria-controls="execution-matrix-content"
            >
              <div className="flex items-center gap-2">
                <span>Matriz de Execução</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover border-border text-foreground text-[10px] max-w-[250px] p-3 space-y-2">
                      <p className="font-black text-command-purple uppercase tracking-widest text-[9px]">O que é isso?</p>
                      <p>Mostra quantas lojas existem em cada faixa de execução, agrupadas pela frequência mensal contratada.</p>
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-muted-foreground italic">Exemplo:</p>
                        <p><span className="text-foreground font-bold">4x/mês + 0%</span> → lojas com 4 visitas mensais contratadas que ainda não tiveram nenhuma visita realizada.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-primary uppercase tracking-tighter opacity-0 group-hover/title:opacity-100 transition-opacity">
                  {matrixCollapsed ? "Ver matriz" : "Ocultar matriz"}
                </span>
                {matrixCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-hover/title:text-primary" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform group-hover/title:text-primary" />
                )}
              </div>
            </div>
          }
          subtitle="Lojas por frequência contratada e cobertura"
          className={cn("xl:col-span-2 transition-all duration-500 ease-in-out", matrixCollapsed ? "h-fit" : "h-full")}
          height={matrixCollapsed ? 0 : 300}
        >
          <div 
            id="execution-matrix-content"
            className={cn(
              "flex flex-col gap-4 overflow-hidden transition-all duration-500 ease-in-out",
              matrixCollapsed ? "max-h-0 opacity-0 pointer-events-none" : "max-h-[1000px] opacity-100 pt-4"
            )}
          >
            <div className="grid grid-cols-5 gap-2 min-w-[600px]">
              {[
                { label: "0%", sub: "SEM VISITA", color: "text-rose-500" },
                { label: "1-49%", sub: "BAIXA EXEC.", color: "text-rose-400" },
                { label: "50-99%", sub: "PARCIAL", color: "text-amber-400" },
                { label: "100%", sub: "COMPLETA", color: "text-emerald-400" },
                { label: ">100%", sub: "ACIMA META", color: "text-blue-400" }
              ].map((faixa) => (
                <div
                  key={faixa.label}
                  className="flex flex-col items-center justify-center p-2 rounded-lg bg-card/50 border border-border/50"
                >
                  <span className={cn("text-[10px] font-black uppercase tracking-tighter", faixa.color)}>
                    {faixa.label}
                  </span>
                  <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest mt-0.5 whitespace-nowrap">
                    {faixa.sub}
                  </span>
                </div>
              ))}
              {matrix.map((cell, idx) => {
                const isCritical = cell.count > 0 && (cell.coverageLabel === "0%" || cell.coverageLabel === "1-49%");
                const isHealthy = cell.count > 0 && cell.coverageLabel === "100%";
                const isAbove = cell.count > 0 && cell.coverageLabel === ">100%";
                
                return (
                  <TooltipProvider key={idx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "group flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300 relative overflow-hidden",
                            cell.count > 0 
                              ? "bg-white/[0.03] border-border hover:border-white/30 cursor-help" 
                              : "bg-background/40 border-border/50 opacity-30 select-none"
                          )}
                        >
                          {cell.count > 0 && (
                            <div className={cn(
                              "absolute top-0 left-0 w-full h-0.5",
                              isCritical ? "bg-rose-500" : isHealthy ? "bg-emerald-500" : isAbove ? "bg-blue-500" : "bg-white/10"
                            )} />
                          )}
                          
                          <span className={cn(
                            "text-xl font-black italic transition-transform group-hover:scale-110",
                            cell.count > 0 ? "text-foreground" : "text-slate-700"
                          )}>
                            {cell.count}
                          </span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                            LOJAS
                          </span>
                          <div className="mt-2 px-1.5 py-0.5 rounded bg-input/50 border border-border/50">
                            <span className="text-[8px] font-black text-command-purple uppercase">
                              {cell.frequency}x/mês
                            </span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-popover border-border text-foreground text-[10px] p-3 shadow-2xl space-y-2">
                        <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                          <span className="text-muted-foreground uppercase font-black">Frequência:</span>
                          <span className="text-command-purple font-black">{cell.frequency}x/mês</span>
                        </div>
                        <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                          <span className="text-muted-foreground uppercase font-black">Cobertura:</span>
                          <span className={cn("font-black", isCritical ? "text-rose-500" : isHealthy ? "text-emerald-500" : "text-foreground")}>
                            {cell.coverageLabel === ">100%" ? "Acima de 100%" : cell.coverageLabel}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground uppercase font-black">Lojas:</span>
                          <span className="text-foreground font-black">{cell.count}</span>
                        </div>
                        <p className="text-muted-foreground italic mt-2 border-t border-border/50 pt-2 leading-relaxed">
                          {cell.coverageLabel === "0%" && `Estas lojas possuem ${cell.frequency} visitas mensais contratadas e ainda não tiveram visitas realizadas.`}
                          {cell.coverageLabel === "1-49%" && `Estas lojas estão com execução parcial baixa em relação às ${cell.frequency} visitas contratadas.`}
                          {cell.coverageLabel === "50-99%" && `Estas lojas estão em progresso para cumprir as ${cell.frequency} visitas contratadas.`}
                          {cell.coverageLabel === "100%" && `Estas lojas cumpriram integralmente a frequência de ${cell.frequency} visitas contratadas.`}
                          {cell.coverageLabel === ">100%" && `Estas lojas receberam mais visitas do que as ${cell.frequency} visitas contratadas.`}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic text-center">
              Ex.: 126 lojas em 4x/mês e 0% ainda não tiveram nenhuma visita realizada.
            </p>
          </div>
        </AnalyticsChartCard>

        <AnalyticsChartCard
          title={
            <div className="flex items-center gap-2">
              <span>Distribuição de Frequência</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover border-border text-foreground text-[10px] max-w-[200px]">
                    Mostra quantas lojas estão contratadas em cada frequência mensal de visitas.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          }
          subtitle="Lojas por frequência contratada"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={frequencies} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis type="number" hide />
              <YAxis
                dataKey="frequency"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#fff", fontWeight: "bold" }}
              />
              <RechartsTooltip
                cursor={{ fill: "rgba(255,255,255,0.02)" }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isManual = String(label).toLowerCase() === "manual";
                    return (
                      <div className="bg-popover border border-border p-3 rounded-xl shadow-2xl min-w-[120px]">
                        <p className="text-[10px] font-black text-foreground uppercase tracking-widest mb-1">
                          {label}x/mês
                        </p>
                        <p className="text-xs font-bold text-foreground/80">
                          {data.stores} {data.stores === 1 ? "loja" : "lojas"}
                        </p>
                        {isManual && (
                          <p className="text-[8px] text-muted-foreground italic mt-2 border-t border-border/50 pt-1">
                            Frequência definida por configuração específica.
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="stores" radius={[0, 4, 4, 0]} name="Lojas">
                {frequencies.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#3B82F6" : "#A855F7"} />
                ))}
              </Bar>
            </BarChart>

          </ResponsiveContainer>
        </AnalyticsChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Mk9Panel className="xl:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-[0.1em]">
                Top Prioridades
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                Lojas críticas e reincidentes
              </p>
            </div>
          </div>

          <AnalyticsTable
            headers={["Loja", "Indústria", "Score", "Motivo"]}
            rows={topPriorities.slice(0, 8).map((p) => [
              <div key={p.storeId} className="flex flex-col">
                <span className="font-bold text-foreground uppercase tracking-tighter truncate w-32">
                  {p.storeName}
                </span>
              </div>,
              <span key={p.storeId} className="text-[10px] font-bold text-muted-foreground uppercase">
                {p.industryName}
              </span>,
              <span
                key={p.storeId}
                className={cn(
                  "font-black",
                  p.score > 80
                    ? "text-rose-500"
                    : p.score > 50
                      ? "text-amber-500"
                      : "text-emerald-500",
                )}
              >
                {p.score}
              </span>,
              <span key={p.storeId} className="text-[9px] font-bold text-muted-foreground uppercase">
                {p.reason}
              </span>,
            ])}
          />
        </Mk9Panel>

        {/* Lojas Reincidentes */}
        {data.recurrence.length > 0 && (
          <Mk9Panel className="xl:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <History className="h-5 w-5 text-rose-500" />
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-[0.1em]">
                  Lojas Reincidentes
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Falhas consecutivas
                </p>
              </div>
            </div>

            <AnalyticsTable
              headers={["Loja", "Indústria", "Histórico", "Status"]}
              rows={data.recurrence.slice(0, 6).map((r) => [
                <div key={`${r.storeId}-${r.industryName}`} className="flex flex-col">
                  <span className="font-bold text-foreground uppercase tracking-tighter truncate w-32">
                    {r.storeName}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase">{r.uf}</span>
                </div>,
                <span
                  key={`${r.storeId}-${r.industryName}`}
                  className="text-[10px] font-bold text-muted-foreground uppercase truncate w-20"
                >
                  {r.industryName}
                </span>,
                <div key={`${r.storeId}-${r.industryName}`} className="flex gap-1">
                  {r.history.map((h, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center p-1 rounded bg-white/[0.03] border border-border/50 min-w-[35px]"
                    >
                      <span className="text-[6px] font-black text-muted-foreground">{h.period}</span>
                      <span
                        className={cn(
                          "text-[8px] font-black",
                          h.realized === 0 ? "text-rose-500" : "text-foreground",
                        )}
                      >
                        {h.realized}
                      </span>
                    </div>
                  ))}
                </div>,
                <Mk9Badge
                  variant={r.status === "CRITICAL_RECURRENT" ? "danger" : "warning"}
                  key={`${r.storeId}-${r.industryName}`}
                >
                  {r.status === "CRITICAL_RECURRENT" ? "REINCIDENTE" : "ALERTA"}
                </Mk9Badge>,
              ])}
            />
          </Mk9Panel>
        )}

        {/* Industry Performance */}
        <Mk9Panel className="xl:col-span-1" id="industry-analysis">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-foreground uppercase tracking-[0.1em]">
                Análise por Indústria
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                Ranking de performance e risco
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {industries.slice(0, 6).map((ind) => (
              <div
                key={ind.industryId}
                className="p-4 rounded-xl bg-card/50 border border-border/50 group hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-command-purple" />
                    <span className="text-[11px] font-black text-foreground uppercase tracking-tight">
                      {ind.industryName}
                    </span>
                  </div>
                  <Mk9Badge
                    variant={
                      ind.risk === "CRITICAL"
                        ? "danger"
                        : ind.risk === "HIGH"
                          ? "warning"
                          : "success"
                    }
                  >
                    {ind.trend === "IMPROVING"
                      ? "Evoluindo"
                      : ind.trend === "WORSENING"
                        ? "Queda"
                        : "Estável"}
                  </Mk9Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-3">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">
                      Cobertura
                    </span>
                    <span
                      className={cn(
                        "text-xs font-black",
                        ind.coverage.delta >= 0 ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {formatPercentage(ind.coverage.current)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">
                      Delta
                    </span>
                    <span className="text-xs font-bold text-foreground/80">
                      {ind.coverage.delta > 0 ? "+" : ""}
                      {formatPercentage(ind.coverage.delta)}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">
                      Zeradas
                    </span>
                    <span className="text-xs font-bold text-rose-400">
                      {ind.zeroVisits.current}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">
                      Risco
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-black",
                        ind.risk === "CRITICAL" ? "text-rose-500" : "text-amber-500",
                      )}
                    >
                      {ind.risk}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Mk9Panel>
      </div>

      {/* Projection Block */}
      <Mk9Panel className="bg-gradient-to-r from-command-deep to-command-purple/10 border-command-purple/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-command-purple/30">
              <TrendingUp className="h-6 w-6 text-command-purple" />
            </div>
            <div>
              <h3 className="text-lg font-black text-foreground uppercase italic">
                Projeção de Fechamento
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Baseado no ritmo atual · {projection.daysRemaining} dias restantes
              </p>
            </div>
          </div>
          <div className="flex gap-10">
            <div className="text-center">
              <span className="block text-[10px] font-black text-muted-foreground uppercase">
                Realizado
              </span>
              <span className="text-2xl font-black text-foreground italic">
                {nf(projection.realized)}
              </span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] font-black text-muted-foreground uppercase">
                Projetado
              </span>
              <span className="text-2xl font-black text-command-purple italic">
                {nf(projection.projected)}
              </span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] font-black text-muted-foreground uppercase">
                Contratado
              </span>
              <span className="text-2xl font-black text-slate-600 italic">
                {nf(projection.contracted)}
              </span>
            </div>
          </div>
          <Mk9Badge
            variant={
              projection?.riskStatus === "CRITICAL"
                ? "danger"
                : projection?.riskStatus === "HIGH"
                  ? "warning"
                  : "success"
            }
            className="h-10 px-6 text-sm"
          >
            RISCO {projection?.riskStatus || "N/D"}
          </Mk9Badge>
        </div>
      </Mk9Panel>

      {/* Performance by UF Table */}
      <Mk9Panel>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-[0.1em]">
              Análise por UF
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Performance regional e variação
            </p>
          </div>
        </div>

        <AnalyticsTable
          headers={["UF", "Lojas", "Contratadas", "Realizadas", "Cobertura", "Delta", "Zeradas"]}
          rows={ufs.map((u) => [
            <div key={u.uf} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-[10px] font-black text-command-purple border border-command-purple/20">
                {u.uf}
              </div>
              <span className="font-black text-foreground">{u.uf}</span>
            </div>,
            <span key={u.uf} className="font-bold text-muted-foreground">
              {u.stores}
            </span>,
            <span key={u.uf} className="font-bold text-muted-foreground">
              {u.contracted}
            </span>,
            <span key={u.uf} className="font-bold text-foreground">
              {u.realized}
            </span>,
            <div key={u.uf} className="flex items-center gap-2">
              <span
                className={cn(
                  "font-black text-xs",
                  u.variationVsPrevious >= 0 ? "text-emerald-400" : "text-amber-400",
                )}
              >
                {formatPercentage(u.coverage)}
              </span>

              <div className="flex-1 h-1 bg-muted/30 rounded-full min-w-[60px] hidden md:block">

                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${u.coverage}%` }}
                />
              </div>
            </div>,
            <span
              key={u.uf}
              className={cn(
                "font-bold text-xs",
                u.variationVsPrevious >= 0 ? "text-emerald-500" : "text-rose-500",
              )}
            >
              {u.variationVsPrevious > 0 ? "+" : ""}
              {formatPercentage(u.variationVsPrevious)}

            </span>,
            <Mk9Badge variant={u.zeroVisits > 0 ? "danger" : "default"} key={u.uf}>
              {u.zeroVisits} LOJAS
            </Mk9Badge>,
          ])}
        />
      </Mk9Panel>
    </div>
  );
}
