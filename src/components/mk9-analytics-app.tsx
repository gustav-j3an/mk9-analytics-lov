import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mk9ImportModule } from "@/components/mk9-import-module";
import { Mk9ChecklistImportModule } from "@/components/mk9-checklist-import-module";
import { Mk9ReconciliationModule } from "@/components/mk9-reconciliation-module";
import { Mk9IndustryReportModule } from "@/components/mk9-industry-report-module";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  FileSpreadsheet,
  Factory,
  Loader2,
  PackageCheck,
  Route,
  Search,
  Store,
  Upload,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  mk9ListIndustries,
  mk9ListStores,
  mk9ListPromoters,
  mk9ListRoutesDetailed,
  mk9ListVisitsDetailed,
  mk9DashboardContractMetrics,
} from "@/lib/mk9-data.functions";

type ModuleId =
  | "dashboard"
  | "industrias"
  | "lojas"
  | "promotores"
  | "roteiros"
  | "visitas"
  | "conciliacao"
  | "relatorio_industria"
  | "importacoes"
  | "checklists";

type ModuleGroup = "Visão geral" | "Operação" | "Relatórios" | "Dados" | "Importações";
const modules: Array<{ id: ModuleId; label: string; icon: typeof BarChart3; group: ModuleGroup }> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3, group: "Visão geral" },
  { id: "roteiros", label: "Roteiros", icon: Route, group: "Operação" },
  { id: "visitas", label: "Visitas", icon: Calendar, group: "Operação" },
  { id: "conciliacao", label: "Conciliação", icon: CheckCircle2, group: "Operação" },
  { id: "relatorio_industria", label: "Indústrias (PDF)", icon: PackageCheck, group: "Relatórios" },
  { id: "industrias", label: "Indústrias", icon: Factory, group: "Dados" },
  { id: "lojas", label: "Lojas", icon: Store, group: "Dados" },
  { id: "promotores", label: "Promotores", icon: Users, group: "Dados" },
  { id: "importacoes", label: "Base MK9", icon: Upload, group: "Importações" },
  { id: "checklists", label: "Checklists", icon: ClipboardCheck, group: "Importações" },
];
const moduleGroups: ModuleGroup[] = ["Visão geral", "Operação", "Relatórios", "Dados", "Importações"];

const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const WEEKDAY_PT = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

const chartColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

function shortDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

// ---- hooks: dados do banco ----
function useMk9Data(month: number, year: number) {
  const industriesFn = useServerFn(mk9ListIndustries);
  const storesFn = useServerFn(mk9ListStores);
  const promotersFn = useServerFn(mk9ListPromoters);
  const routesFn = useServerFn(mk9ListRoutesDetailed);
  const visitsFn = useServerFn(mk9ListVisitsDetailed);
  const contractMetricsFn = useServerFn(mk9DashboardContractMetrics);

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn() });
  const storesQ = useQuery({ queryKey: ["mk9-stores"], queryFn: () => storesFn() });
  const promotersQ = useQuery({ queryKey: ["mk9-promoters"], queryFn: () => promotersFn() });
  const routesQ = useQuery({ queryKey: ["mk9-routes", month, year], queryFn: () => routesFn({ data: { month, year } }) });
  const visitsQ = useQuery({ queryKey: ["mk9-visits", month, year], queryFn: () => visitsFn({ data: { month, year } }) });
  const contractMetricsQ = useQuery({ queryKey: ["mk9-contract-metrics", month, year], queryFn: () => contractMetricsFn({ data: { month, year } }) });

  return { industriesQ, storesQ, promotersQ, routesQ, visitsQ, contractMetricsQ };
}

export function Mk9AnalyticsApp() {
  const now = new Date();
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const { industriesQ, storesQ, promotersQ, routesQ, visitsQ, contractMetricsQ } = useMk9Data(month, year);

  const industries = industriesQ.data ?? [];
  const stores = storesQ.data ?? [];
  const promoters = promotersQ.data ?? [];
  const routes = routesQ.data ?? [];
  const visits = visitsQ.data ?? [];
  const contractMetrics = contractMetricsQ.data;

  const metrics = useMemo(() => {
    if (contractMetrics) {
      return {
        planned: contractMetrics.contratadas,
        completed: contractMetrics.executadas,
        cancelled: visits.filter((v) => v.status === "cancelled").length,
        delayed: visits.filter((v) => v.status === "planned" && v.scheduledDate < new Date().toISOString().slice(0, 10)).length,
        coverage: contractMetrics.coverage,
        contratadas: contractMetrics.contratadas,
        executadas: contractMetrics.executadas,
        validas: contractMetrics.validas,
        extras: contractMetrics.extras,
        pendencias: contractMetrics.pendencias,
      };
    }
    // Fallback enquanto o backend calcula: mantém a tela estável.
    const perStoreMap = new Map<string, { contratadas: number; executadas: number }>();
    for (const v of visits) {
      const key = (v as any).storeId ?? (v as any).storeName ?? v.id;
      const cur = perStoreMap.get(key) ?? { contratadas: 0, executadas: 0 };
      cur.contratadas += 1;
      if (v.status === "completed") cur.executadas += 1;
      perStoreMap.set(key, cur);
    }
    let contratadas = 0, executadas = 0, extras = 0;
    for (const s of perStoreMap.values()) {
      contratadas += s.contratadas;
      executadas += s.executadas;
      extras += Math.max(0, s.executadas - s.contratadas);
    }
    // Realizadas = total bruto. Pendentes/cobertura globais = contratadas - realizadas.
    const pendencias = Math.max(0, contratadas - executadas);
    const validas = Math.min(contratadas, executadas);
    const planned = contratadas;
    const completed = executadas;
    const cancelled = visits.filter((v) => v.status === "cancelled").length;
    const today = new Date().toISOString().slice(0, 10);
    const delayed = visits.filter((v) => v.status === "planned" && v.scheduledDate < today).length;
    const coverage = contratadas > 0 ? Math.min(100, Math.round((executadas / contratadas) * 100)) : 0;
    return { planned, completed, cancelled, delayed, coverage, contratadas, executadas, validas, extras, pendencias };
  }, [contractMetrics, visits]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const term = query.toLowerCase();
    return [
      ...stores.filter((s) => `${s.name} ${s.chain ?? ""} ${s.uf ?? ""}`.toLowerCase().includes(term)).map((s) => ({ type: "Loja", label: s.name })),
      ...promoters.filter((p) => `${p.name} ${p.city ?? ""}`.toLowerCase().includes(term)).map((p) => ({ type: "Promotor", label: p.name })),
      ...industries.filter((i) => i.name.toLowerCase().includes(term)).map((i) => ({ type: "Indústria", label: i.name })),
    ].slice(0, 6);
  }, [industries, promoters, query, stores]);

  const moduleTitle = modules.find((item) => item.id === activeModule)?.label ?? "Dashboard";
  const sidebarWidth = collapsed ? "76px" : "264px";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div
        className="grid min-h-screen transition-[grid-template-columns] duration-300 lg:grid-cols-[var(--sb)_1fr]"
        style={{ ["--sb" as string]: sidebarWidth }}
      >
        <aside className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-6 p-3 lg:p-4">
            <div className={cn("flex items-center gap-3 px-1", collapsed && "lg:justify-center lg:px-0")}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_8px_20px_-8px_var(--color-primary)]">
                <BarChart3 className="h-5 w-5" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold leading-tight tracking-tight">MK9 Analytics</p>
                  <p className="truncate text-[11px] text-muted-foreground">Trade marketing operacional</p>
                </div>
              )}
            </div>

            <nav className="flex flex-col gap-4" aria-label="Módulos principais">
              {moduleGroups.map((group) => {
                const items = modules.filter((m) => m.group === group);
                return (
                  <div key={group} className="flex flex-col gap-1">
                    {!collapsed && (
                      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                        {group}
                      </p>
                    )}
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = activeModule === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveModule(item.id)}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                            collapsed && "lg:justify-center lg:px-0",
                          )}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                          )}
                          <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "")} />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>

            <div className="mt-auto flex flex-col gap-3">
              {!collapsed && (
                <div className="glass-panel rounded-xl p-3 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Operação ativa</p>
                  <p className="mt-1 truncate font-medium">{MONTHS_PT[month - 1]} / {year}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <span className="rounded-md bg-[color-mix(in_oklab,var(--color-kpi-green)_14%,transparent)] px-2 py-1 text-center font-medium text-[color:var(--color-kpi-green)]">
                      {metrics.coverage}% cob.
                    </span>
                    <span className="rounded-md bg-[color-mix(in_oklab,var(--color-kpi-amber)_18%,transparent)] px-2 py-1 text-center font-medium text-[color:var(--color-kpi-amber)]">
                      {metrics.delayed} atrasos
                    </span>
                  </div>
                </div>
              )}
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="hidden h-9 items-center justify-center gap-2 rounded-lg border border-sidebar-border text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground lg:flex"
              >
                {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Recolher</>}
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-xl">
            <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between lg:px-8">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span>MK9</span>
                  <span className="text-border">/</span>
                  <span>{moduleTitle}</span>
                </div>
                <h1 className="mt-0.5 truncate text-[22px] font-semibold tracking-tight md:text-2xl">{moduleTitle}</h1>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="hidden md:flex items-center gap-2">
                  <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                    <SelectTrigger className="h-10 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS_PT.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" className="h-10 w-[92px]" value={year} onChange={(e) => setYear(Number(e.target.value))} min={2024} max={2100} />
                </div>
                <div className="relative w-full md:w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar lojas, promotores…"
                    className="h-10 rounded-lg border-border/70 bg-muted/50 pl-9 pr-3 text-sm shadow-none transition-all focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/25"
                    aria-label="Buscar no sistema"
                  />
                  {searchResults.length > 0 && (
                    <div className="animate-fade-up absolute right-0 top-12 z-10 w-full overflow-hidden rounded-xl border border-border/80 bg-popover p-1.5 shadow-[var(--shadow-elevated)]">
                      {searchResults.map((result) => (
                        <div key={`${result.type}-${result.label}`} className="flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-accent">
                          <span className="truncate">{result.label}</span>
                          <Badge variant="outline" className="text-[10px]">{result.type}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  aria-label="Notificações"
                  className="relative grid h-10 w-10 place-items-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Bell className="h-[18px] w-[18px]" />
                </button>
                <button className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-semibold text-primary-foreground shadow-sm">
                  MK
                </button>
              </div>
            </div>
          </header>

          <div key={activeModule} className="animate-fade-up mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
            {activeModule === "dashboard" && (
              <DashboardModule
                metrics={metrics}
                industries={industries}
                stores={stores}
                promoters={promoters}
                routes={routes}
                visits={visits}
                onOpenModule={setActiveModule}
                loading={industriesQ.isLoading || visitsQ.isLoading}
              />
            )}
            {activeModule === "industrias" && <IndustriesModule industries={industries} loading={industriesQ.isLoading} />}
            {activeModule === "lojas" && <StoresModule stores={stores} routes={routes} loading={storesQ.isLoading} />}
            {activeModule === "promotores" && <PromotersModule promoters={promoters} routes={routes} visits={visits} loading={promotersQ.isLoading} />}
            {activeModule === "roteiros" && <RoutesModule routes={routes} loading={routesQ.isLoading} month={month} year={year} />}
            {activeModule === "visitas" && <VisitsModule visits={visits} loading={visitsQ.isLoading} />}
            {activeModule === "importacoes" && (
              <Mk9ImportModule onSwitchToChecklists={() => setActiveModule("checklists")} />
            )}
            {activeModule === "checklists" && (
              <Mk9ChecklistImportModule onSwitchToBase={() => setActiveModule("importacoes")} />
            )}
            {activeModule === "conciliacao" && <Mk9ReconciliationModule />}
            {activeModule === "relatorio_industria" && <Mk9IndustryReportModule />}
          </div>
        </section>
      </div>
    </main>
  );
}

// -------------------- Dashboard --------------------
function DashboardModule({
  metrics, industries, stores, promoters, routes, visits, onOpenModule, loading,
}: {
  metrics: { planned: number; completed: number; cancelled: number; delayed: number; coverage: number; contratadas: number; executadas: number; validas: number; extras: number; pendencias: number };
  industries: any[]; stores: any[]; promoters: any[]; routes: any[]; visits: any[];
  onOpenModule: (module: ModuleId) => void; loading: boolean;
}) {
  const visitsByStatus = [
    { name: "Realizadas", value: metrics.completed },
    { name: "Planejadas", value: Math.max(metrics.planned - metrics.completed - metrics.cancelled, 0) },
    { name: "Canceladas", value: metrics.cancelled },
  ];

  // execução diária dos últimos 7 dias com base em planned_visits
  const dailySeries = useMemo(() => {
    const map = new Map<string, { planejadas: number; realizadas: number }>();
    for (const v of visits) {
      const d = v.scheduledDate;
      if (!map.has(d)) map.set(d, { planejadas: 0, realizadas: 0 });
      const bucket = map.get(d)!;
      bucket.planejadas += 1;
      if (v.status === "completed") bucket.realizadas += 1;
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([d, b]) => ({ day: d.slice(5).replace("-", "/"), ...b }));
  }, [visits]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard tone="blue" icon={Route} label="Visitas contratadas" value={metrics.contratadas} detail={`${metrics.executadas} executadas`} />
        <KpiCard tone="green" icon={CheckCircle2} label="Cobertura" value={`${metrics.coverage}%`} detail={`${metrics.executadas} realizadas · ${metrics.extras} extras`} />
        <KpiCard tone="amber" icon={AlertTriangle} label="Pendentes" value={metrics.pendencias} detail={`${metrics.delayed} atrasadas`} />
        <KpiCard tone="violet" icon={FileSpreadsheet} label="Rotas ativas" value={routes.length} detail={`${promoters.length} promotores`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="card-hover overflow-hidden border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Execução diária</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Planejadas × realizadas (últimos 7 dias com visitas)</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[color:var(--color-chart-1)]" />Planejadas</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[color:var(--color-chart-2)]" />Realizadas</span>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            {dailySeries.length === 0 ? (
              <EmptyBlock loading={loading} message="Nenhuma visita planejada no período. Importe a planilha." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySeries} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={28} />
                  <Area type="monotone" dataKey="planejadas" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#gPlan)" />
                  <Area type="monotone" dataKey="realizadas" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#gReal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="card-hover overflow-hidden border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status das visitas</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Distribuição atual do período</p>
          </CardHeader>
          <CardContent className="h-72">
            {metrics.planned === 0 ? (
              <EmptyBlock loading={loading} message="Sem visitas no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={visitsByStatus} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="var(--color-card)" strokeWidth={3}>
                    {visitsByStatus.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="card-hover border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-3"><CardTitle className="text-base">Ações rápidas</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <Button className="h-10 justify-start rounded-lg" onClick={() => onOpenModule("importacoes")}><Upload className="h-4 w-4" />Importar planilha MK9</Button>
            <Button variant="secondary" className="h-10 justify-start rounded-lg" onClick={() => onOpenModule("roteiros")}><Route className="h-4 w-4" />Ver roteiros</Button>
            <Button variant="outline" className="h-10 justify-start rounded-lg" onClick={() => onOpenModule("visitas")}><Calendar className="h-4 w-4" />Ver visitas</Button>
          </CardContent>
        </Card>

        <Card className="card-hover border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-3"><CardTitle className="text-base">Cadastros</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <SummaryLine label="Indústrias" value={industries.length} icon={Factory} />
            <SummaryLine label="Lojas" value={stores.length} icon={Store} />
            <SummaryLine label="Promotores" value={promoters.length} icon={Users} />
            <SummaryLine label="Rotas do mês" value={routes.length} icon={Route} />
          </CardContent>
        </Card>

        <Card className="card-hover border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-3"><CardTitle className="text-base">Top promotores (cobertura)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const perPromoter = new Map<string, { total: number; done: number }>();
              for (const v of visits) {
                const key = v.promoterName;
                const b = perPromoter.get(key) ?? { total: 0, done: 0 };
                b.total += 1;
                if (v.status === "completed") b.done += 1;
                perPromoter.set(key, b);
              }
              const ranked = Array.from(perPromoter.entries())
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 6);
              if (ranked.length === 0) return <p className="text-sm text-muted-foreground">Sem dados. Importe a planilha para gerar visitas.</p>;
              return ranked.map(([name, b]) => {
                const pct = b.total > 0 ? Math.round((b.done / b.total) * 100) : 0;
                return (
                  <div key={name}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium truncate pr-2">{name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{b.done}/{b.total} · {pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-[color:var(--color-kpi-green)] transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// -------------------- Indústrias --------------------
function IndustriesModule({ industries, loading }: { industries: any[]; loading: boolean }) {
  const [filter, setFilter] = useState("");
  const rows = industries.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-4">
      <DataToolbar value={filter} onChange={setFilter} placeholder="Filtrar indústrias…" total={industries.length} />
      {loading ? <LoadingBlock /> : industries.length === 0 ? (
        <EmptyState title="Nenhuma indústria cadastrada" hint="Importe a planilha MK9 para popular a base." />
      ) : (
        <TableShell headers={["Indústria", "Freq. contratada", "Freq. estimada", "Diferença", "Status", "Atualizado em"]}>
          {rows.map((i) => (
            <tr key={i.id} className="border-b last:border-0">
              <td className="p-3 font-medium">{i.name}</td>
              <td className="p-3 tabular-nums">{i.monthlyContractedFrequency ?? "—"}</td>
              <td className="p-3 tabular-nums">{i.monthlyEstimatedFrequency ?? "—"}</td>
              <td className="p-3 tabular-nums">{i.frequencyDifference ?? "—"}</td>
              <td className="p-3"><Badge variant={i.frequencyStatus === "ABAIXO DA META" ? "destructive" : "secondary"}>{i.frequencyStatus ?? "SEM META"}</Badge></td>
              <td className="p-3 text-muted-foreground text-xs">{i.updatedAt ? new Date(i.updatedAt).toLocaleString("pt-BR") : "—"}</td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  );
}

// -------------------- Lojas --------------------
function StoresModule({ stores, routes, loading }: { stores: any[]; routes: any[]; loading: boolean }) {
  const [filter, setFilter] = useState("");
  const routesByStore = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of routes) if (r.storeId) m.set(r.storeId, (m.get(r.storeId) ?? 0) + 1);
    return m;
  }, [routes]);
  const rows = stores.filter((s) => `${s.name} ${s.chain ?? ""} ${s.uf ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-4">
      <DataToolbar value={filter} onChange={setFilter} placeholder="Filtrar lojas…" total={stores.length} />
      {loading ? <LoadingBlock /> : stores.length === 0 ? (
        <EmptyState title="Nenhuma loja cadastrada" hint="Importe a planilha MK9 para popular a base." />
      ) : (
        <TableShell headers={["Loja", "Rede", "UF", "Rotas no mês", "Atualizado em"]}>
          {rows.map((s) => (
            <tr key={s.id} className="border-b last:border-0">
              <td className="p-3 font-medium">{s.name}</td>
              <td className="p-3 text-muted-foreground">{s.chain ?? "—"}</td>
              <td className="p-3"><Badge variant="outline">{s.uf ?? "—"}</Badge></td>
              <td className="p-3 tabular-nums">{routesByStore.get(s.id) ?? 0}</td>
              <td className="p-3 text-muted-foreground text-xs">{s.updatedAt ? new Date(s.updatedAt).toLocaleString("pt-BR") : "—"}</td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  );
}

// -------------------- Promotores --------------------
function PromotersModule({ promoters, routes, visits, loading }: { promoters: any[]; routes: any[]; visits: any[]; loading: boolean }) {
  const [filter, setFilter] = useState("");
  const stats = useMemo(() => {
    const m = new Map<string, { stores: Set<string>; routes: number; visits: number }>();
    for (const r of routes) {
      if (!r.promoterId) continue;
      const b = m.get(r.promoterId) ?? { stores: new Set(), routes: 0, visits: 0 };
      if (r.storeId) b.stores.add(r.storeId);
      b.routes += 1;
      m.set(r.promoterId, b);
    }
    for (const v of visits) {
      const key = promoters.find((p) => p.name === v.promoterName)?.id;
      if (!key) continue;
      const b = m.get(key) ?? { stores: new Set(), routes: 0, visits: 0 };
      b.visits += 1;
      m.set(key, b);
    }
    return m;
  }, [promoters, routes, visits]);

  const rows = promoters.filter((p) => `${p.name} ${p.city ?? ""} ${p.contact ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-4">
      <DataToolbar value={filter} onChange={setFilter} placeholder="Filtrar promotores…" total={promoters.length} />
      {loading ? <LoadingBlock /> : promoters.length === 0 ? (
        <EmptyState title="Nenhum promotor cadastrado" hint="Importe a planilha MK9 para popular a base." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const s = stats.get(p.id);
            return (
              <Card key={p.id} className="card-hover border-border/70">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{p.city ?? "—"}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{s?.routes ?? 0} rotas</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                    <MiniStat label="Lojas" value={s?.stores.size ?? 0} />
                    <MiniStat label="Rotas" value={s?.routes ?? 0} />
                    <MiniStat label="Visitas" value={s?.visits ?? 0} />
                  </div>
                  {p.contact && <p className="text-xs text-muted-foreground pt-1">Contato: {p.contact}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -------------------- Roteiros --------------------
function RoutesModule({ routes, loading, month, year }: { routes: any[]; loading: boolean; month: number; year: number }) {
  const [filter, setFilter] = useState("");
  // Agrupamento: Promotor → Dia da semana → Loja → [Indústrias]
  const grouped = useMemo(() => {
    const byPromoter = new Map<string, Map<number, Map<string, { store: any; industries: Set<string> }>>>();
    for (const r of routes) {
      const promoterKey = r.promoterName;
      if (!byPromoter.has(promoterKey)) byPromoter.set(promoterKey, new Map());
      const byDay = byPromoter.get(promoterKey)!;
      if (!byDay.has(r.weekday)) byDay.set(r.weekday, new Map());
      const byStore = byDay.get(r.weekday)!;
      const storeKey = `${r.storeName}::${r.storeUf ?? ""}`;
      if (!byStore.has(storeKey)) byStore.set(storeKey, { store: r, industries: new Set() });
      byStore.get(storeKey)!.industries.add(r.industryName);
    }
    return byPromoter;
  }, [routes]);

  const promoterNames = Array.from(grouped.keys())
    .sort()
    .filter((n) => n.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <DataToolbar value={filter} onChange={setFilter} placeholder="Filtrar por promotor…" total={routes.length} />
      <p className="text-xs text-muted-foreground">Roteiros do mês {MONTHS_PT[month - 1]} / {year}.</p>
      {loading ? <LoadingBlock /> : routes.length === 0 ? (
        <EmptyState title="Nenhum roteiro no período" hint="Importe a planilha MK9 do mês selecionado." />
      ) : (
        <div className="space-y-4">
          {promoterNames.map((name) => {
            const days = grouped.get(name)!;
            const sortedDays = Array.from(days.keys()).sort();
            return (
              <Card key={name} className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sortedDays.map((wd) => {
                    const stores = days.get(wd)!;
                    return (
                      <div key={wd} className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">{WEEKDAY_PT[wd]}</p>
                        <div className="space-y-2">
                          {Array.from(stores.values()).map((entry, i) => (
                            <div key={i} className="flex items-start justify-between gap-3 border-l-2 border-primary/40 pl-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {entry.store.storeChain ? `${entry.store.storeChain} · ` : ""}{entry.store.storeName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {Array.from(entry.industries).join(", ")}
                                </p>
                              </div>
                              {entry.store.storeUf && <Badge variant="outline" className="text-[10px] shrink-0">{entry.store.storeUf}</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -------------------- Visitas --------------------
const VISIT_STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  planned: { label: "Planejada", variant: "secondary" },
  completed: { label: "Realizada", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  skipped: { label: "Não realizada", variant: "destructive" },
};

function VisitsModule({ visits, loading }: { visits: any[]; loading: boolean }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filter, setFilter] = useState("");
  const filtered = visits
    .filter((v) => statusFilter === "all" || v.status === statusFilter)
    .filter((v) => `${v.promoterName} ${v.storeName} ${v.industryName}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([
          { id: "all", label: "Todas" },
          { id: "planned", label: "Planejadas" },
          { id: "completed", label: "Realizadas" },
          { id: "cancelled", label: "Canceladas" },
        ] as const).map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={statusFilter === s.id ? "default" : "outline"}
            onClick={() => setStatusFilter(s.id)}
          >{s.label}</Button>
        ))}
        <div className="flex-1 min-w-[240px]">
          <DataToolbar value={filter} onChange={setFilter} placeholder="Filtrar visitas…" />
        </div>
      </div>
      {loading ? <LoadingBlock /> : visits.length === 0 ? (
        <EmptyState title="Nenhuma visita no período" hint="Importe a planilha MK9 para gerar as visitas planejadas." />
      ) : (
        <TableShell headers={["Data", "Promotor", "Loja", "Indústria", "Status", "Origem"]}>
          {filtered.slice(0, 1000).map((v) => {
            const st = VISIT_STATUS_LABEL[v.status] ?? { label: v.status, variant: "secondary" as const };
            return (
              <tr key={v.id} className="border-b last:border-0">
                <td className="p-3 tabular-nums">{shortDate(v.scheduledDate)}</td>
                <td className="p-3">{v.promoterName}</td>
                <td className="p-3">{v.storeChain ? <span className="text-muted-foreground">{v.storeChain} · </span> : null}{v.storeName}</td>
                <td className="p-3 text-muted-foreground">{v.industryName}</td>
                <td className="p-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                <td className="p-3 text-xs text-muted-foreground">{v.sourceSheet ?? "—"}</td>
              </tr>
            );
          })}
        </TableShell>
      )}
      {filtered.length > 1000 && <p className="text-xs text-muted-foreground">Mostrando 1000 de {filtered.length} visitas.</p>}
    </div>
  );
}

// -------------------- helpers de UI --------------------
const kpiTones = {
  blue: { text: "text-[color:var(--color-kpi-blue)]", bg: "bg-[color-mix(in_oklab,var(--color-kpi-blue)_12%,transparent)]", ring: "shadow-[0_8px_24px_-12px_var(--color-kpi-blue)]" },
  green: { text: "text-[color:var(--color-kpi-green)]", bg: "bg-[color-mix(in_oklab,var(--color-kpi-green)_14%,transparent)]", ring: "shadow-[0_8px_24px_-12px_var(--color-kpi-green)]" },
  amber: { text: "text-[color:var(--color-kpi-amber)]", bg: "bg-[color-mix(in_oklab,var(--color-kpi-amber)_18%,transparent)]", ring: "shadow-[0_8px_24px_-12px_var(--color-kpi-amber)]" },
  violet: { text: "text-[color:var(--color-kpi-violet)]", bg: "bg-[color-mix(in_oklab,var(--color-kpi-violet)_14%,transparent)]", ring: "shadow-[0_8px_24px_-12px_var(--color-kpi-violet)]" },
} as const;

function KpiCard({ icon: Icon, label, value, detail, tone = "blue" }: { icon: typeof BarChart3; label: string; value: string | number; detail: string; tone?: keyof typeof kpiTones }) {
  const t = kpiTones[tone];
  return (
    <Card className={cn("card-hover animate-fade-up group relative overflow-hidden border-border/70 shadow-[var(--shadow-soft)]", t.ring)}>
      <div className={cn("absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-70 blur-2xl transition-opacity group-hover:opacity-100", t.bg)} />
      <CardContent className="relative flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-[32px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", t.bg, t.text)}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryLine({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof BarChart3 }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-background/60 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DataToolbar({ value, onChange, placeholder, total }: { value: string; onChange: (v: string) => void; placeholder: string; total?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
      </div>
      {typeof total === "number" && <Badge variant="secondary" className="shrink-0">{total} registros</Badge>}
    </div>
  );
}

function TableShell({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>{headers.map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />Carregando dados do banco…
    </div>
  );
}

function EmptyBlock({ loading, message }: { loading: boolean; message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
      {loading ? "Carregando…" : message}
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center">
      <PackageCheck className="mx-auto h-8 w-8 text-muted-foreground/60" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
