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
import { getAnalyticsDashboard } from "@/lib/mk9-dashboard/analytics.functions";
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

  const analyticsFn = useServerFn(getAnalyticsDashboard);
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

  const { summary, frequencyDistribution, states, criticalStores, industries, dailyExecution } = data;

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
          value={nf(summary.contratadas)} 
          icon={Activity} 
          color="blue"
        />
        <AnalyticsMetricCard 
          label="Visitas Realizadas" 
          value={nf(summary.realizadas)} 
          icon={CheckCircle2} 
          color="emerald"
        />
        <AnalyticsMetricCard 
          label="Visitas Pendentes" 
          value={nf(summary.pendentes)} 
          icon={Clock} 
          color="amber"
        />
        <AnalyticsMetricCard 
          label="Extras Realizadas" 
          value={nf(summary.extras)} 
          icon={TrendingUp} 
          color="purple"
        />
        <AnalyticsMetricCard 
          label="Cobertura Geral" 
          value={`${summary.cobertura}%`} 
          icon={Activity} 
          color="cyan"
          comparison={{ value: 12, label: "vs meta proporcional", trend: summary.cobertura > 90 ? "up" : "down" }}
        />
        <AnalyticsMetricCard 
          label="Lojas Zero Visitas" 
          value={nf(summary.lojasSemAtendimento)} 
          icon={AlertTriangle} 
          color="rose"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <AnalyticsChartCard 
          title="Evolução da Execução" 
          subtitle="Visitas acumuladas por dia"
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyExecution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A855F7" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: "#64748b" }} 
                tickFormatter={(v) => v.slice(8, 10)}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#64748b" }} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#080812", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                itemStyle={{ fontSize: "11px", color: "#fff", textTransform: "uppercase" }}
                labelStyle={{ color: "#64748b", fontSize: "10px", marginBottom: "4px" }}
              />
              <Area type="monotone" dataKey="expected" stroke="#A855F7" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" name="Meta" />
              <Area type="monotone" dataKey="realized" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorReal)" name="Realizado" />
            </AreaChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard 
          title="Distribuição de Frequência" 
          subtitle="Lojas por visitas contratadas"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={frequencyDistribution} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="label" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: "#fff", fontWeight: "bold" }} 
              />
              <Tooltip 
                cursor={{ fill: "rgba(255,255,255,0.02)" }}
                contentStyle={{ backgroundColor: "#080812", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Lojas">
                {frequencyDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#3B82F6" : "#A855F7"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Critical Stores Table */}
        <Mk9Panel className="xl:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Lojas que Exigem Ação</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Ordenado por criticidade operacional</p>
            </div>
            <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-command-purple hover:bg-command-purple/10">
              Ver Todas <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </div>
          
          <AnalyticsTable 
            headers={["Loja", "Indústria", "Contr.", "Real.", "Cobert."]}
            rows={criticalStores.slice(0, 8).map(s => [
              <div key={s.storeId} className="flex flex-col">
                <span className="font-bold text-white uppercase tracking-tighter truncate w-32">{s.storeName}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">{s.uf}</span>
              </div>,
              <span key={s.storeId} className="text-[10px] font-bold text-slate-400 uppercase">{s.industryName}</span>,
              <span key={s.storeId} className="font-black text-slate-300">{s.contratadas}</span>,
              <span key={s.storeId} className="font-black text-slate-300">{s.realizadas}</span>,
              <div key={s.storeId} className="flex items-center gap-2">
                <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full", s.cobertura > 80 ? "bg-emerald-500" : s.cobertura > 50 ? "bg-amber-500" : "bg-rose-500")}
                    style={{ width: `${s.cobertura}%` }}
                  />
                </div>
                <span className={cn("text-[10px] font-black", s.cobertura > 80 ? "text-emerald-500" : s.cobertura > 50 ? "text-amber-500" : "text-rose-500")}>
                  {s.cobertura}%
                </span>
              </div>
            ])}
          />
        </Mk9Panel>

        {/* Industry Performance */}
        <Mk9Panel className="xl:col-span-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Análise por Indústria</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Ranking de performance de malha</p>
            </div>
          </div>

          <div className="space-y-3">
            {industries.slice(0, 6).map((ind: any) => (
              <div key={ind.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-command-purple" />
                    <span className="text-[11px] font-black text-white uppercase tracking-tight">{ind.name}</span>
                  </div>
                  <Mk9Badge variant={ind.cobertura > 85 ? "success" : ind.cobertura > 60 ? "warning" : "danger"}>
                    {ind.cobertura > 85 ? "Saudável" : ind.cobertura > 60 ? "Atenção" : "Crítica"}
                  </Mk9Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-3">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Lojas</span>
                    <span className="text-xs font-bold text-slate-300">{ind.lojas}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Contratadas</span>
                    <span className="text-xs font-bold text-slate-300">{ind.contratadas}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Realizadas</span>
                    <span className="text-xs font-bold text-white">{ind.realizadas}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Cobertura</span>
                    <span className={cn("text-xs font-black", ind.cobertura > 85 ? "text-emerald-400" : "text-amber-400")}>{ind.cobertura}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Mk9Panel>
      </div>

      {/* Performance by UF Table */}
      <Mk9Panel>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Execução por UF</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Visão regional da malha operacional</p>
          </div>
        </div>
        
        <AnalyticsTable 
          headers={["UF", "Lojas", "Contratadas", "Realizadas", "Pendentes", "Cobertura", "Lojas Zeradas"]}
          rows={states.map(s => [
            <div key={s.uf} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-command-purple/10 flex items-center justify-center text-[10px] font-black text-command-purple border border-command-purple/20">
                {s.uf}
              </div>
              <span className="font-black text-white">{s.uf}</span>
            </div>,
            <span key={s.uf} className="font-bold text-slate-400">{s.lojas}</span>,
            <span key={s.uf} className="font-bold text-slate-400">{s.contratadas}</span>,
            <span key={s.uf} className="font-bold text-white">{s.realizadas}</span>,
            <span key={s.uf} className="font-bold text-slate-400">{Math.max(0, s.contratadas - s.realizadas)}</span>,
            <div key={s.uf} className="flex items-center gap-2">
               <span className={cn("font-black", s.cobertura > 85 ? "text-emerald-400" : "text-amber-400")}>{s.cobertura}%</span>
               <div className="flex-1 h-1 bg-white/5 rounded-full min-w-[60px] hidden md:block">
                 <div className="h-full bg-command-purple rounded-full" style={{ width: `${s.cobertura}%` }} />
               </div>
            </div>,
            <Mk9Badge variant={s.zeradas > 0 ? "danger" : "default"} key={s.uf}>
              {s.zeradas} LOJAS
            </Mk9Badge>
          ])}
        />
      </Mk9Panel>
    </div>
  );
}
