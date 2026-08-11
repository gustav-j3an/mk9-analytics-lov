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
  MoreVertical,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMk9AnalyticsDashboardFn } from "@/lib/mk9-analytics/analytics.functions";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";
import { CollapsibleDashboardSection } from "./mk9/CollapsibleDashboardSection";

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

  const toggleAllSections = (open: boolean) => {
    window.dispatchEvent(new CustomEvent("mk9_dashboard_section_sync", {
      detail: { storageKey: "__ALL__", isOpen: open }
    }));
  };

  const restoreDefaults = () => {
    window.dispatchEvent(new CustomEvent("mk9_dashboard_section_sync", {
      detail: { storageKey: "__RESTORE_DEFAULT__" }
    }));
  };

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

  const { data, isLoading, error, refetch } = useQuery({
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
      <div className="flex items-center justify-end gap-2">
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 text-[10px]">
                    <MoreVertical className="h-3 w-3" />
                    Organizar painel
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover border-border text-popover-foreground">
                <DropdownMenuItem onClick={() => toggleAllSections(true)} className="text-xs font-bold uppercase tracking-tighter cursor-pointer">Expandir tudo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleAllSections(false)} className="text-xs font-bold uppercase tracking-tighter cursor-pointer">Recolher tudo</DropdownMenuItem>
                <DropdownMenuItem onClick={restoreDefaults} className="text-xs font-bold uppercase tracking-tighter cursor-pointer">Restaurar padrão</DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </div>

      {/* FILTROS */}
      <CollapsibleDashboardSection title="Filtros" storageKey="filters" defaultOpen={true}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Mês</label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-10 bg-card/40 border-border/50 text-[11px] font-bold uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS_PT.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Ano</label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-10 bg-card/40 border-border/50 text-[11px] font-bold uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">Indústria</label>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger className="h-10 bg-card/40 border-border/50 text-[11px] font-bold uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">Todas as Indústrias</SelectItem>
                {(industriesQ.data || []).map(ind => (
                  <SelectItem key={ind.id} value={ind.id}>{ind.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1">UF</label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger className="h-10 bg-card/40 border-border/50 text-[11px] font-bold uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">Todas as UFs</SelectItem>
                {ufs.map(u => (
                  <SelectItem key={u.uf} value={u.uf}>{u.uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleDashboardSection>

      {/* RESUMO OPERACIONAL */}
      <CollapsibleDashboardSection title="Resumo Operacional" storageKey="summary" defaultOpen={true}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="glass-command p-4 rounded-2xl border border-border/50 bg-card/50 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Indústrias Monitoradas</span>
              </div>
              <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground italic">{data.perf?.monitoredIndustriesCount ?? 0}</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">DE {industries.length}</span>
              </div>
            </div>
            <div className="glass-command p-5 rounded-2xl border border-border/50 bg-card/50 flex flex-col justify-between">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Status de Risco</span>
                <div className="flex items-center gap-2">
                    <span className={cn("text-xl font-black italic uppercase", projection?.riskStatus === "CRITICAL" ? "text-rose-500" : "text-foreground")}>
                        {projection?.riskStatus || "N/D"}
                    </span>
                </div>
            </div>
            <div className="glass-command p-4 rounded-2xl border border-border/50 bg-card/50 flex flex-col justify-between">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Projeção Final</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-foreground italic">{nf(projection.projected)}</span>
                </div>
            </div>
            <div className="glass-command p-4 rounded-2xl border border-border/50 bg-card/50 flex flex-col justify-between">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Meta Proporcional</span>
                <div className="flex flex-col">
                    <span className="text-lg font-black text-foreground italic">
                        {rawExecutive?.coverage ? formatPercentage(executive.coverage.current) : "N/D"}
                    </span>
                </div>
            </div>
            <div className="glass-command p-4 rounded-2xl border border-border/50 bg-card/50 flex flex-col justify-between">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Última Atualização</span>
                <div className="flex items-center gap-2 text-foreground/70">
                    <span className="text-xs font-bold uppercase">
                    {lastUpdate ? new Date(lastUpdate).toLocaleTimeString("pt-BR") : "—"}
                    </span>
                </div>
            </div>
        </div>
      </CollapsibleDashboardSection>

      {/* PRIORIDADES / ALERTAS CRÍTICOS */}
      <CollapsibleDashboardSection title="Prioridades Críticas" storageKey="priorities" defaultOpen={true}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnalyticsMetricCard 
            label="Visitas Pendentes"
            value={nf(executive.pending.current)}
            icon={Clock}
            color="amber"
            comparison={{
              value: executive.pending.delta,
              label: "vs mês anterior",
              trend: executive.pending.delta > 0 ? "up" : "down"
            }}
          />
          <AnalyticsMetricCard 
            label="Cobertura Geral"
            value={formatPercentage(executive.coverage.current)}
            icon={TrendingUp}
            color="purple"
            comparison={{
              value: executive.coverage.delta,
              label: "vs mês anterior",
              trend: executive.coverage.delta > 0 ? "up" : "down"
            }}
          />
          <AnalyticsMetricCard 
            label="Lojas Sem Visita"
            value={nf(executive.zeroVisits.current)}
            icon={AlertTriangle}
            color="rose"
            comparison={{
              value: executive.zeroVisits.delta,
              label: "vs mês anterior",
              trend: executive.zeroVisits.delta > 0 ? "up" : "down"
            }}
          />
        </div>
      </CollapsibleDashboardSection>

      {/* VISITAS E COBERTURA */}
      <CollapsibleDashboardSection title="Visitas e Cobertura" storageKey="visits" defaultOpen={true}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <AnalyticsChartCard title="Evolução de Cobertura por Indústria" subtitle="Top 5 melhores performances">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={industries.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="industryName" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                />
                <Bar dataKey="coverage.current" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>

          <AnalyticsChartCard title="Status Operacional" subtitle="Distribuição atual de execução">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Realizadas', value: executive.realized.current },
                    { name: 'Pendentes', value: executive.pending.current },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="var(--primary)" />
                  <Cell fill="rgba(255,255,255,0.1)" />
                </Pie>
                <RechartsTooltip 
                   contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>
        </div>
      </CollapsibleDashboardSection>

      {/* MATRIZ DE EXECUÇÃO */}
      <CollapsibleDashboardSection title="Matriz de Execução" subtitle="Distribuição por frequência e cobertura" storageKey="matrix" defaultOpen={false}>
        <div className="glass-command rounded-2xl overflow-hidden border border-border/50">
          <AnalyticsTable 
            headers={["Frequência", "Faixa de Cobertura", "Total Lojas"]}
            rows={matrix.map(row => [
              <span className="font-bold uppercase tracking-widest text-[10px]">{row.frequency}</span>,
              <span className="font-bold text-muted-foreground">{row.coverageLabel}</span>,
              <span className="font-black text-primary">{nf(row.count)}</span>
            ])}
          />
        </div>
      </CollapsibleDashboardSection>

      {/* DISTRIBUIÇÃO DE FREQUÊNCIA */}
      <CollapsibleDashboardSection title="Distribuição de Frequência" storageKey="distribution" defaultOpen={false}>
        <AnalyticsChartCard title="Lote Operacional" subtitle="Volume de lojas por frequência contratada" height={400}>
          <ResponsiveContainer width="100%" height="100%">
             <BarChart data={frequencies}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="frequency" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                   contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                />
                <Bar dataKey="stores" fill="var(--primary)" radius={[4, 4, 0, 0]} />
             </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      </CollapsibleDashboardSection>

      {/* TOP PRIORIDADES & LOJAS REINCIDENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CollapsibleDashboardSection title="Top Prioridades" storageKey="top_priorities" defaultOpen={false}>
          <div className="glass-command rounded-2xl border border-border/50">
            <AnalyticsTable 
              headers={["Loja", "Indústria", "Motivo"]}
              rows={topPriorities.slice(0, 10).map(p => [
                <div className="flex flex-col">
                  <span className="font-bold text-foreground text-[10px] uppercase truncate max-w-[150px]">{p.storeName}</span>
                </div>,
                <span className="text-[9px] font-black text-muted-foreground uppercase">{p.industryName}</span>,
                <Mk9Badge variant="danger">{p.reason}</Mk9Badge>
              ])}
            />
          </div>
        </CollapsibleDashboardSection>

        <CollapsibleDashboardSection title="Lojas Reincidentes" storageKey="recurring_stores" defaultOpen={false}>
           <div className="glass-command rounded-2xl border border-border/50">
            <AnalyticsTable 
              headers={["Loja", "Frequência", "Status"]}
              rows={data.recurrence?.slice(0, 10).map((rec: any) => [
                <span className="font-bold text-foreground text-[10px] uppercase truncate max-w-[150px]">{rec.storeName}</span>,
                <span className="text-[9px] font-black text-muted-foreground uppercase">{rec.currentFrequency}x</span>,
                <div className="flex items-center gap-2 justify-end">
                   <Mk9Badge variant={rec.status === "CRITICAL_RECURRENT" ? "danger" : "warning"}>
                      {rec.status}
                   </Mk9Badge>
                </div>
              ]) || []}
            />
          </div>
        </CollapsibleDashboardSection>
      </div>

      <div className="text-center p-10 text-muted-foreground text-xs uppercase tracking-[0.3em] font-black opacity-30">
        Painel MK9 Analytics - Comando Central Operacional
      </div>
    </div>
  );
}
