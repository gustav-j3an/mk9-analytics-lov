/**
 * MK9 — Cockpit Operacional: interface (Centro de Comando).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Factory,
  FileText,
  Gauge,
  Map as MapIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  Users,
  Route as RouteIcon,
  TrendingUp,
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

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { mk9ListIndustries, mk9ListPromoters } from "@/lib/mk9-data.functions";
import { mk9CockpitOverviewFn } from "@/lib/mk9-cockpit.functions";
import type {
  Mk9CockpitOverview,
  Mk9HealthLevel,
  Mk9QuickActionId,
} from "@/lib/mk9-cockpit/types";
import { ChartCard } from "./mk9-command-center/ChartCard";
import { 
  Mk9PageHeader, 
  Mk9MetricCard, 
  Mk9Panel, 
  Mk9LoadingState, 
  Mk9ErrorState,
  Mk9Badge 
} from "./mk9/design-system";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ALL = "__ALL__";

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

export function Mk9CockpitModule({ onNavigate }: { onNavigate?: (target: string) => void }) {
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
    year, month,
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

  const go = (target: string | null) => {
    if (!target) return;
    if (onNavigate) onNavigate(target);
    else window.location.assign(target);
  };

  if (q.isLoading) return <Mk9LoadingState message="Acessando matriz do cockpit..." />;
  if (q.isError) return <Mk9ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-8 animate-fade-up">
      <Mk9PageHeader 
        title="Cockpit Operacional" 
        subtitle="Monitoramento da execução em tempo real"
        icon={Gauge}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 w-[130px] bg-command-deep border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                {MONTHS_PT.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 w-[96px] bg-command-deep border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger className="h-9 w-[160px] bg-command-deep border-white/10 text-white"><SelectValue placeholder="Indústria" /></SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                <SelectItem value={ALL}>Todas as Indústrias</SelectItem>
                {industries.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={promoterId} onValueChange={setPromoterId}>
              <SelectTrigger className="h-9 w-[160px] bg-command-deep border-white/10 text-white"><SelectValue placeholder="Promotor" /></SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                <SelectItem value={ALL}>Todos os Promotores</SelectItem>
                {promoters.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Button size="sm" variant="outline" className="h-9 border-white/10 bg-white/5 text-slate-400 hover:text-white" onClick={() => q.refetch()}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-2", q.isFetching && "animate-spin")} /> Sincronizar
            </Button>
          </div>
        }
      />

      {/* KPIs Superiores */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Mk9MetricCard color="blue" icon={RouteIcon} label="Contratadas" value={data.kpis.contratadas} hint="Meta total" />
        <Mk9MetricCard color="emerald" icon={CheckCircle2} label="Realizadas" value={data.kpis.realizadas} hint={`${data.kpis.coberturaPct}% cobertura`} />
        <Mk9MetricCard color="amber" icon={AlertTriangle} label="Pendentes" value={data.kpis.pendentes} hint="Visitas em aberto" />
        <Mk9MetricCard color="rose" icon={AlertTriangle} label="Críticas" value={data.health.blockingIssues} hint="Bloqueantes" />
        <Mk9MetricCard color="purple" icon={TrendingUp} label="Cobertura" value={`${data.kpis.coberturaPct}%`} hint={`Ritmo: ${data.health.pacePercentage}%`} />
        <Mk9MetricCard color="blue" icon={Users} label="Promotores" value={promoters.length} hint="Time em campo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <ChartCard title="Execução Operacional" subtitle="Contratado acumulado vs Realizado">
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94A3B8" }} width={30} />
                <RTooltip 
                  contentStyle={{ backgroundColor: "#111122", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  itemStyle={{ fontSize: "12px", color: "#fff" }}
                />
                <Line type="monotone" dataKey="expected" stroke="#A855F7" strokeWidth={3} dot={false} name="Esperado" />
                <Line type="monotone" dataKey="realized" stroke="#3B82F6" strokeWidth={3} dot={false} name="Realizado" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <Mk9Panel title="🚨 Prioridades de Comando">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Alertas Ativos</h3>
            </div>
            <div className="space-y-3">
              {data.priorities.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors group">
                  <div className="flex items-center gap-4">
                    <span className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-500">{idx + 1}</span>
                    <div>
                      <p className="text-sm font-black text-white uppercase tracking-tight">{p.title}</p>
                      <p className="text-xs text-slate-500 font-medium">{p.description}</p>
                    </div>
                  </div>
                  {p.deepLink && (
                    <Button variant="ghost" size="sm" className="h-8 gap-2 text-slate-400 group-hover:text-command-purple transition-colors" onClick={() => go(p.deepLink)}>
                      Tratar <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Mk9Panel>
        </div>

        <div className="space-y-6">
          <Mk9Panel className="h-full">
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-6">Ações Rápidas</h3>
            <div className="grid grid-cols-2 gap-3">
              {data.quickActions.map((a) => {
                const Icon = ACTION_ICON[a.id] ?? BarChart3;
                return (
                  <button
                    key={a.id}
                    onClick={() => go(a.target)}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-command-purple/10 hover:border-command-purple/30 transition-all group"
                  >
                    <Icon className="h-6 w-6 text-slate-500 group-hover:text-command-purple mb-2 transition-colors" />
                    <span className="text-[9px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest text-center">{a.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Saúde do Sistema</h3>
              <div className={cn(
                "p-4 rounded-xl border flex items-center gap-3",
                data.health.level === 'SAUDAVEL' ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400" : "bg-amber-500/5 border-amber-500/10 text-amber-400"
              )}>
                 <div className={cn("h-2 w-2 rounded-full animate-pulse", data.health.level === 'SAUDAVEL' ? "bg-emerald-500" : "bg-amber-500")} />
                 <span className="text-[10px] font-black uppercase tracking-widest">{data.health.level}</span>
              </div>
              <p className="text-xs text-slate-500 italic leading-relaxed px-1">
                {data.health.reason}
              </p>
            </div>
          </Mk9Panel>
        </div>
      </div>
    </div>
  );
}
