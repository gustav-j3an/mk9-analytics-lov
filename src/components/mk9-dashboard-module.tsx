import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Factory,
  RefreshCw,
  Route as RouteIcon,
  Users,
  ShieldAlert,
  ShieldCheck,
  Info,
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { mk9ListIndustries, mk9ListPromoters } from "@/lib/mk9-data.functions";
import {
  mk9DashboardOverviewFn,
  mk9DashboardCheckIntegrityFn,
} from "@/lib/mk9-dashboard.functions";

import { type DashboardOverview } from "@/lib/mk9-dashboard/types";

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
const ALL = "__ALL__";

export interface DashboardDrillDown {
  month: number;
  year: number;
  industryId?: string | null;
  uf?: string | null;
  promoterId?: string | null;
}

function nf(v: number) {
  return new Intl.NumberFormat("pt-BR").format(v);
}

export function Mk9DashboardModule({
  onDrillDown,
}: {
  onDrillDown?: (f: DashboardDrillDown) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [industryId, setIndustryId] = useState(ALL);
  const [uf, setUf] = useState(ALL);
  const [promoterId, setPromoterId] = useState(ALL);

  const overviewFn = useServerFn(mk9DashboardOverviewFn);
  const industriesFn = useServerFn(mk9ListIndustries);
  const promotersFn = useServerFn(mk9ListPromoters);

  const industriesQ = useQuery({
    queryKey: ["mk9-industries"],
    queryFn: () => industriesFn(),
    staleTime: 300000,
  });
  const promotersQ = useQuery({
    queryKey: ["mk9-promoters"],
    queryFn: () => promotersFn(),
    staleTime: 300000,
  });

  const params = {
    year,
    month,
    industryId: industryId === ALL ? null : industryId,
    uf: uf === ALL ? null : uf,
    promoterId: promoterId === ALL ? null : promoterId,
  };

  const overviewQ = useQuery({
    queryKey: [
      "mk9-dashboard",
      params.year,
      params.month,
      params.industryId,
      params.uf,
      params.promoterId,
    ],
    queryFn: () => overviewFn({ data: params }),
    staleTime: 60000,
    placeholderData: (prev) => prev,
  });

  const data = overviewQ.data as DashboardOverview | undefined;
  const loading = overviewQ.isLoading;

  const drill = (f: Partial<DashboardDrillDown>) =>
    onDrillDown?.({
      month,
      year,
      industryId: f.industryId ?? (industryId === ALL ? null : industryId),
      uf: f.uf ?? (uf === ALL ? null : uf),
      promoterId: f.promoterId ?? (promoterId === ALL ? null : promoterId),
    });

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  const filtersNode = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <FilterField label="Mês">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="h-9 bg-card border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            {MONTHS_PT.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Ano">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-9 bg-card border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Indústria">
        <Select value={industryId} onValueChange={setIndustryId}>
          <SelectTrigger className="h-9 bg-card border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value={ALL}>Todas as indústrias</SelectItem>
            {(industriesQ.data ?? []).map((i: any) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="UF">
        <Select value={uf} onValueChange={setUf}>
          <SelectTrigger className="h-9 bg-card border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value={ALL}>Todas as UFs</SelectItem>
            {(data?.availableUfs ?? []).map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Promotor">
        <Select value={promoterId} onValueChange={setPromoterId}>
          <SelectTrigger className="h-9 bg-card border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value={ALL}>Todos os promotores</SelectItem>
            {(promotersQ.data ?? []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );

  return (
    <DashboardErrorBoundary>
      <div className="space-y-8 animate-fade-up">
        <DashboardHeader month={month} year={year} />

        <div className="glass-command p-6 rounded-2xl shadow-2xl border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
              Parâmetros de Comando
            </h3>
            <div className="flex items-center gap-3">
              <DashboardIntegrityCheck params={params} />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                onClick={() => overviewQ.refetch()}
                disabled={overviewQ.isFetching}
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5 mr-2", overviewQ.isFetching && "animate-spin")}
                />
                Sincronizar
              </Button>
            </div>
          </div>
          {filtersNode}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2">
            <DashboardHero
              label="Execução de Malha"
              percentage={data?.kpis.coberturaPct ?? 0}
              status={
                data?.kpis.coberturaPct && data.kpis.coberturaPct > 85
                  ? "Operação Estável"
                  : data?.kpis.coberturaPct && data.kpis.coberturaPct > 60
                    ? "Atenção Necessária"
                    : "Alerta Crítico"
              }
            />
          </div>
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PerformanceCard
              label="Nível de Entrega"
              percentage={
                data
                  ? Math.min(
                      100,
                      Math.round(
                        (data.kpis.realizedToDate / (data.kpis.expectedToDate || 1)) * 100,
                      ),
                    )
                  : 0
              }
              status={
                data && data.kpis.realizedToDate / (data.kpis.expectedToDate || 1) > 0.95
                  ? "Excelente"
                  : "Atenção"
              }
              comparison={`Ritmo: ${data?.kpis.pacePercentage ?? 0}% do esperado`}
            />
            <MetricCard
              color="rose"
              icon={Factory}
              label="Indústrias Risco"
              value={nf(data?.kpis.industriasEmRisco ?? 0)}
              hint="Ação imediata requerida"
              onClick={() => drill({})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            color="blue"
            icon={RouteIcon}
            label="Contratadas"
            value={nf(data?.kpis.contractedTotal ?? 0)}
            hint={`Meta: ${nf(data?.kpis.expectedToDate ?? 0)}`}
            onClick={() => drill({})}
          />
          <MetricCard
            color="emerald"
            icon={CheckCircle2}
            label="Realizadas"
            value={nf(data?.kpis.realizedToDate ?? 0)}
            hint={`${data?.kpis.coberturaPct}% de cobertura`}
            onClick={() => drill({})}
          />
          <MetricCard
            color="amber"
            icon={AlertTriangle}
            label="Pendências"
            value={nf(data?.kpis.pendentes ?? 0)}
            hint="Visitas em aberto"
            onClick={() => drill({})}
          />
          <MetricCard
            color="purple"
            icon={Users}
            label="Promotores"
            value={nf(promotersQ.data?.length ?? 0)}
            hint="Equipe em campo"
            onClick={() => drill({})}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard
            title="Fluxo Operacional"
            subtitle="Projeção de visitas vs Realizado acumulado"
          >
            {loading || !data ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(8) + "/" + v.slice(5, 7)}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    width={30}
                  />
                  <RTooltip
                    contentStyle={{
                      backgroundColor: "#111122",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#94A3B8" }}
                    itemStyle={{ fontSize: "12px", color: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="expected"
                    stroke="#A855F7"
                    fillOpacity={1}
                    fill="url(#colorExp)"
                    strokeWidth={2}
                    name="Esperado"
                  />
                  <Area
                    type="monotone"
                    dataKey="realized"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#colorReal)"
                    strokeWidth={2}
                    name="Realizado"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Performance por Status"
            subtitle="Indústrias classificadas por nível de entrega"
          >
            {loading || !data ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.industryStatusDistribution}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    width={30}
                  />
                  <RTooltip
                    contentStyle={{
                      backgroundColor: "#111122",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Indústrias">
                    {data.industryStatusDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.key === "CONCLUIDA"
                            ? "#10B981"
                            : entry.key === "ATENCAO"
                              ? "#F59E0B"
                              : "#EF4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <MK9IndustryCard
          industries={(data?.industries ?? []).slice(0, 9).map((i) => ({
            name: i.industryName,
            percentage: i.coberturaPct,
            visits: i.realizadas,
            status: i.coberturaPct > 85 ? "Excelente" : i.coberturaPct > 60 ? "Atenção" : "Crítico",
          }))}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RankingCard
              items={(data?.promoters ?? []).slice(0, 5).map((p, idx) => ({
                position: idx + 1,
                name: p.promoterName,
                id: p.promoterId?.slice(0, 8) || "N/A",
                visits: p.realizadas,
                score: p.coberturaPct,
              }))}
            />
          </div>

          <ChartCard
            title="Execução Lojas"
            subtitle="Distribuição por tipo de atendimento"
            className="h-full"
          >
            {loading || !data ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.storeExecutionDistribution}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                  >
                    {data.storeExecutionDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.key === "INTEGRAL"
                            ? "#10B981"
                            : entry.key === "PARCIAL"
                              ? "#F59E0B"
                              : "#EF4444"
                        }
                      />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={{
                      backgroundColor: "#111122",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>
    </DashboardErrorBoundary>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function DashboardIntegrityCheck({ params }: { params: any }) {
  const checkFn = useServerFn(mk9DashboardCheckIntegrityFn);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["mk9-dashboard-integrity", params],
    queryFn: () => checkFn({ data: params }),
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 text-muted-foreground hover:text-command-purple hover:bg-muted/30 transition-colors"
        >
          <ShieldAlert className="h-4 w-4" />
          <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">
            Integridade
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md bg-background text-foreground border-white/5">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-foreground uppercase font-black tracking-tighter">
            <ShieldCheck className="h-5 w-5 text-command-purple" />
            Diagnóstico de Sistema
          </SheetTitle>
        </SheetHeader>
        <div className="mt-8 space-y-6">
          <div className="text-xs text-muted-foreground font-medium leading-relaxed">
            Varredura heurística em tempo real para detecção de anomalias na malha operacional.
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="h-10 w-10 animate-spin text-command-purple/20" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Processando Matriz...
              </p>
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div
                className={cn(
                  "p-5 rounded-2xl border flex items-center gap-4 transition-all",
                  data.ok
                    ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                    : "bg-amber-500/5 border-amber-500/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.05)]",
                )}
              >
                {data.ok ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">
                    {data.ok ? "Integridade Confirmada" : "Inconsistências Detectadas"}
                  </p>
                  <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest mt-0.5">
                    {data.ok
                      ? "Base de dados operacional sem anomalias críticas."
                      : "Foram encontrados problemas na matriz operacional."}
                  </p>
                </div>
              </div>

              {!data.ok && data.issues && (
                <div className="space-y-3 mt-8">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">
                    Relatório de Anomalias
                  </h4>
                  {data.issues.map((f: any, i: number) => (
                    <div
                      key={i}
                      className="glass-command p-4 rounded-xl border border-white/5 flex gap-4 items-start group hover:border-border transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <p className="text-xs font-black text-slate-200 uppercase tracking-tight">
                          {f.kind}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium leading-normal">
                          {f.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center">
              <Info className="h-10 w-10 text-slate-700 mx-auto mb-4" />
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                Nenhum dado retornado
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
