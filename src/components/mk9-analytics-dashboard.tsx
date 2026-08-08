import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
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
  Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Mk9Panel, 
  Mk9Badge, 
  Mk9LoadingState, 
  Mk9ErrorState 
} from "./mk9/design-system";
import { 
  AnalyticsMetricCard, 
  AnalyticsChartCard, 
  AnalyticsTable 
} from "./mk9/AnalyticsComponents";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getMk9AnalyticsDashboardFn } from "@/lib/mk9-analytics/analytics.functions";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function nf(v: number) {
  return new Intl.NumberFormat("pt-BR").format(v);
}

export function Mk9AnalyticsDashboard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [industryId, setIndustryId] = useState("__ALL__");
  const [uf, setUf] = useState("__ALL__");

  const analyticsFn = useServerFn(getMk9AnalyticsDashboardFn);
  const industriesFn = useServerFn(mk9ListIndustries);

  const industriesQ = useQuery({ 
    queryKey: ["mk9-industries-list"], 
    queryFn: () => industriesFn(),
    staleTime: 300000 
  });

  const params = {
    year,
    month,
    industryId: industryId === "__ALL__" ? null : industryId,
    uf: uf === "__ALL__" ? null : uf,
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["mk9-analytics-data", params],
    queryFn: () => analyticsFn({ data: params }),
    staleTime: 60000,
  });

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  if (isLoading) return <Mk9LoadingState message="Inicializando Comando Analítico..." />;
  if (error) return <Mk9ErrorState message="Erro ao carregar matriz analítica." onRetry={() => refetch()} />;
  if (!data) return <Mk9ErrorState message="Nenhum dado retornado para este período." onRetry={() => refetch()} />;

  const { executive, industries, ufs, frequencies, matrix, projection, topPriorities, lastUpdate } = data;

  return (
    <div className="space-y-8 animate-fade-in pb-20 selection:bg-purple-500/30">
      {/* Performance Debug (Visible in Dev) */}
      {data.perf && (
        <div className="flex items-center gap-4 text-[9px] font-mono text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">
          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" /> Core: {data.perf.coreMs}ms</span>
          <span className="flex items-center gap-1"><Database className="h-3 w-3 text-blue-500" /> Queries: {data.perf.queryCount}</span>
          <span className="flex items-center gap-1"><Cpu className="h-3 w-3 text-purple-500" /> Payload: Consolidade</span>
        </div>
      )}

      {/* Visão de Risco e Projeção (Executive View) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cn(
          "glass-command p-4 rounded-2xl border flex flex-col justify-between",
          projection.riskStatus === "CRITICAL" ? "border-rose-500/30 bg-rose-500/5" : "border-white/5 bg-white/[0.02]"
        )}>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Status de Risco</span>
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-3 w-3 rounded-full animate-pulse",
              projection.riskStatus === "CRITICAL" ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" :
              projection.riskStatus === "HIGH" ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "bg-emerald-500"
            )} />
            <span className={cn(
              "text-xl font-black italic uppercase",
              projection.riskStatus === "CRITICAL" ? "text-rose-500" : "text-white"
            )}>
              {projection.riskStatus}
            </span>
          </div>
        </div>

        <div className="glass-command p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Projeção Final</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white italic">{nf(projection.projected)}</span>
            <span className="text-[10px] font-bold text-slate-500">vs {nf(projection.contracted)}</span>
          </div>
        </div>

        <div className="glass-command p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Meta Proporcional</span>
          <div className="flex flex-col">
            <div className="flex justify-between items-end mb-1">
              <span className="text-lg font-black text-white italic">{executive.coverage.current}%</span>
              <span className="text-[9px] font-bold text-slate-500">FALTAM {nf(executive.pending.current)}</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-command-purple rounded-full transition-all duration-1000" 
                style={{ width: `${executive.coverage.current}%` }} 
              />
            </div>
          </div>
        </div>

        <div className="glass-command p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Última Atualização</span>
          <div className="flex items-center gap-2 text-white/70">
            <Clock className="h-4 w-4 text-command-purple" />
            <span className="text-xs font-bold uppercase">{new Date(lastUpdate).toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
      </div>


      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
             <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
               MK9 <span className="text-command-purple">ANALYTICS</span>
             </h1>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-5">
            Inteligência Operacional · V1.0.0
          </p>
        </div>

        <div className="glass-command p-2 rounded-2xl flex flex-wrap items-center gap-2 border border-white/5">
           <div className="flex items-center gap-2 px-2 border-r border-white/5 mr-2 hidden sm:flex">
             <Filter className="h-3 w-3 text-slate-500" />
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Filtros</span>
           </div>
           
           <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
             <SelectTrigger className="h-8 min-w-[120px] bg-black/40 border-white/5 text-[10px] font-bold text-white uppercase tracking-wider">
               <SelectValue />
             </SelectTrigger>
             <SelectContent className="bg-command-deep border-white/10 text-white">
               {MONTHS_PT.map((m, i) => <SelectItem key={m} value={String(i + 1)} className="text-[10px] font-bold uppercase">{m}</SelectItem>)}
             </SelectContent>
           </Select>

           <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
             <SelectTrigger className="h-8 min-w-[90px] bg-black/40 border-white/5 text-[10px] font-bold text-white">
               <SelectValue />
             </SelectTrigger>
             <SelectContent className="bg-command-deep border-white/10 text-white">
               {years.map((y) => <SelectItem key={y} value={String(y)} className="text-[10px] font-bold">{y}</SelectItem>)}
             </SelectContent>
           </Select>

           <Select value={industryId} onValueChange={setIndustryId}>
             <SelectTrigger className="h-8 min-w-[160px] bg-black/40 border-white/5 text-[10px] font-bold text-white uppercase">
               <SelectValue />
             </SelectTrigger>
             <SelectContent className="bg-command-deep border-white/10 text-white">
               <SelectItem value="__ALL__" className="text-[10px] font-bold uppercase">Todas as Indústrias</SelectItem>
               {(industriesQ.data ?? []).map((i: any) => <SelectItem key={i.id} value={i.id} className="text-[10px] font-bold uppercase">{i.name}</SelectItem>)}
             </SelectContent>
           </Select>

           <Select value={uf} onValueChange={setUf}>
             <SelectTrigger className="h-8 min-w-[80px] bg-black/40 border-white/5 text-[10px] font-bold text-white uppercase">
               <SelectValue />
             </SelectTrigger>
             <SelectContent className="bg-command-deep border-white/10 text-white">
               <SelectItem value="__ALL__" className="text-[10px] font-bold uppercase">UF</SelectItem>
               {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((u) => (
                 <SelectItem key={u} value={u} className="text-[10px] font-bold">{u}</SelectItem>
               ))}
             </SelectContent>
           </Select>

           <Button 
             variant="ghost" 
             size="icon" 
             className="h-8 w-8 text-slate-500 hover:text-white hover:bg-white/5"
             onClick={() => refetch()}
             disabled={isFetching}
           >
             <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
           </Button>
        </div>
      </div>

      {/* Main KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <AnalyticsMetricCard 
          label="Visitas Contratadas" 
          value={nf(executive.contracted.current)} 
          icon={Activity} 
          color="blue"
          comparison={{ 
            value: executive.contracted.previous, 
            label: "anterior", 
            trend: executive.contracted.delta >= 0 ? "up" : "down",
            percentChange: executive.contracted.percentChange
          }}
        />
        <AnalyticsMetricCard 
          label="Visitas Realizadas" 
          value={nf(executive.realized.current)} 
          icon={CheckCircle2} 
          color="emerald"
          comparison={{ 
            value: executive.realized.previous, 
            label: "anterior", 
            trend: executive.realized.delta >= 0 ? "up" : "down",
            percentChange: executive.realized.percentChange
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
            percentChange: executive.pending.percentChange
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
          value={`${executive.coverage.current}%`} 
          icon={Activity} 
          color="cyan"
          comparison={{ 
            value: executive.coverage.previous, 
            label: "anterior", 
            trend: executive.coverage.delta >= 0 ? "up" : "down",
            percentChange: executive.coverage.delta
          }}
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
            percentChange: executive.zeroVisits.percentChange
          }}
        />
      </div>


      {/* Charts & Matrix Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <AnalyticsChartCard 
          title="Matriz de Execução" 
          subtitle="Frequência x Faixa de Cobertura"
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-5 gap-2 h-full">
            {["0%", "1-49%", "50-99%", "100%", ">100%"].map(label => (
              <div key={label} className="text-[8px] font-black text-slate-500 text-center uppercase">{label}</div>
            ))}
            {matrix.map((cell, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border border-white/5 transition-all hover:border-white/20",
                  cell.count > 0 ? "bg-command-purple/10" : "bg-white/[0.02] opacity-50"
                )}
              >
                <span className="text-lg font-black text-white">{cell.count}</span>
                <span className="text-[7px] font-bold text-slate-500 uppercase">{cell.frequency}x</span>
              </div>
            ))}
          </div>
        </AnalyticsChartCard>

        <AnalyticsChartCard 
          title="Distribuição de Frequência" 
          subtitle="Lojas por visitas contratadas"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={frequencies} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="frequency" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: "#fff", fontWeight: "bold" }} 
              />
              <Tooltip 
                cursor={{ fill: "rgba(255,255,255,0.02)" }}
                contentStyle={{ backgroundColor: "#080812", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
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
              <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Top Prioridades</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Lojas críticas e reincidentes</p>
            </div>
          </div>
          
          <AnalyticsTable 
            headers={["Loja", "Indústria", "Score", "Motivo"]}
            rows={topPriorities.slice(0, 8).map(p => [
              <div key={p.storeId} className="flex flex-col">
                <span className="font-bold text-white uppercase tracking-tighter truncate w-32">{p.storeName}</span>
              </div>,
              <span key={p.storeId} className="text-[10px] font-bold text-slate-400 uppercase">{p.industryName}</span>,
              <span key={p.storeId} className={cn(
                "font-black",
                p.score > 80 ? "text-rose-500" : p.score > 50 ? "text-amber-500" : "text-emerald-500"
              )}>{p.score}</span>,
              <span key={p.storeId} className="text-[9px] font-bold text-slate-500 uppercase">{p.reason}</span>
            ])}
          />
        </Mk9Panel>

        {/* Industry Performance */}
        <Mk9Panel className="xl:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Análise por Indústria</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Ranking de performance e risco</p>
            </div>
          </div>

          <div className="space-y-3">
            {industries.slice(0, 6).map((ind) => (
              <div key={ind.industryId} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-command-purple" />
                    <span className="text-[11px] font-black text-white uppercase tracking-tight">{ind.industryName}</span>
                  </div>
                  <Mk9Badge variant={ind.risk === "CRITICAL" ? "danger" : ind.risk === "HIGH" ? "warning" : "success"}>
                    {ind.trend === "IMPROVING" ? "Evoluindo" : ind.trend === "WORSENING" ? "Queda" : "Estável"}
                  </Mk9Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-3">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Cobertura</span>
                    <span className={cn("text-xs font-black", ind.coverage.delta >= 0 ? "text-emerald-400" : "text-amber-400")}>{ind.coverage.current}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Delta</span>
                    <span className="text-xs font-bold text-slate-300">{ind.coverage.delta > 0 ? "+" : ""}{ind.coverage.delta.toFixed(1)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Zeradas</span>
                    <span className="text-xs font-bold text-rose-400">{ind.zeroVisits.current}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Risco</span>
                    <span className={cn("text-[10px] font-black", ind.risk === "CRITICAL" ? "text-rose-500" : "text-amber-500")}>{ind.risk}</span>
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
            <div className="h-12 w-12 rounded-2xl bg-command-purple/20 flex items-center justify-center border border-command-purple/30">
              <TrendingUp className="h-6 w-6 text-command-purple" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase italic">Projeção de Fechamento</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Baseado no ritmo atual · {projection.daysRemaining} dias restantes</p>
            </div>
          </div>
          <div className="flex gap-10">
            <div className="text-center">
              <span className="block text-[10px] font-black text-slate-500 uppercase">Realizado</span>
              <span className="text-2xl font-black text-white italic">{nf(projection.realized)}</span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] font-black text-slate-500 uppercase">Projetado</span>
              <span className="text-2xl font-black text-command-purple italic">{nf(projection.projected)}</span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] font-black text-slate-500 uppercase">Contratado</span>
              <span className="text-2xl font-black text-slate-600 italic">{nf(projection.contracted)}</span>
            </div>
          </div>
          <Mk9Badge variant={projection.riskStatus === "CRITICAL" ? "danger" : projection.riskStatus === "HIGH" ? "warning" : "success"} className="h-10 px-6 text-sm">
            RISCO {projection.riskStatus}
          </Mk9Badge>
        </div>
      </Mk9Panel>

      {/* Performance by UF Table */}
      <Mk9Panel>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Análise por UF</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Performance regional e variação</p>
          </div>
        </div>
        
        <AnalyticsTable 
          headers={["UF", "Lojas", "Contratadas", "Realizadas", "Cobertura", "Delta", "Zeradas"]}
          rows={ufs.map(u => [

            <div key={u.uf} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-command-purple/10 flex items-center justify-center text-[10px] font-black text-command-purple border border-command-purple/20">
                {u.uf}
              </div>
              <span className="font-black text-white">{u.uf}</span>
            </div>,
            <span key={u.uf} className="font-bold text-slate-400">{u.stores}</span>,
            <span key={u.uf} className="font-bold text-slate-400">{u.contracted}</span>,
            <span key={u.uf} className="font-bold text-white">{u.realized}</span>,
            <div key={u.uf} className="flex items-center gap-2">
               <span className={cn("font-black text-xs", u.variationVsPrevious >= 0 ? "text-emerald-400" : "text-amber-400")}>{u.coverage}%</span>
               <div className="flex-1 h-1 bg-white/5 rounded-full min-w-[60px] hidden md:block">
                 <div className="h-full bg-command-purple rounded-full" style={{ width: `${u.coverage}%` }} />
               </div>
            </div>,
            <span key={u.uf} className={cn("font-bold text-xs", u.variationVsPrevious >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {u.variationVsPrevious > 0 ? "+" : ""}{u.variationVsPrevious.toFixed(1)}
            </span>,
            <Mk9Badge variant={u.zeroVisits > 0 ? "danger" : "default"} key={u.uf}>
              {u.zeroVisits} LOJAS
            </Mk9Badge>
          ])}
        />
      </Mk9Panel>
    </div>
  );
}

