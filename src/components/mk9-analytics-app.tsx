import {
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
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
  PackageCheck,
  Plus,
  Route,
  Search,
  Store,
  Upload,
  Users,
} from "lucide-react";
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
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ModuleId =
  | "dashboard"
  | "operacoes"
  | "lojas"
  | "promotores"
  | "roteiros"
  | "visitas"
  | "importacoes"
  | "conciliacao";

type OperationStatus = "ATIVA" | "PLANEJADA" | "FECHADA";
type VisitStatus = "PLANEJADA" | "REALIZADA" | "CANCELADA";
type ImportStatus = "PROCESSADO" | "PENDENTE" | "ERRO";

type Operation = {
  id: string;
  name: string;
  client: string;
  month: string;
  year: string;
  status: OperationStatus;
  coverageGoal: number;
};

type StoreItem = {
  id: string;
  code: string;
  name: string;
  network: string;
  city: string;
  state: string;
};

type Promoter = {
  id: string;
  name: string;
  supervisor: string;
  city: string;
  active: boolean;
};

type Visit = {
  id: string;
  operationId: string;
  promoterId: string;
  storeId: string;
  industry: string;
  plannedDate: string;
  status: VisitStatus;
  evidence?: string;
};

type ImportItem = {
  id: string;
  fileName: string;
  type: string;
  status: ImportStatus;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  createdAt: string;
};

type ModuleGroup = "Visão geral" | "Operação" | "Dados";
const modules: Array<{ id: ModuleId; label: string; icon: typeof BarChart3; group: ModuleGroup }> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3, group: "Visão geral" },
  { id: "operacoes", label: "Operações", icon: ClipboardCheck, group: "Operação" },
  { id: "roteiros", label: "Roteiros", icon: Route, group: "Operação" },
  { id: "visitas", label: "Visitas", icon: Calendar, group: "Operação" },
  { id: "lojas", label: "Lojas", icon: Store, group: "Dados" },
  { id: "promotores", label: "Promotores", icon: Users, group: "Dados" },
  { id: "importacoes", label: "Importações", icon: Upload, group: "Dados" },
  { id: "conciliacao", label: "Conciliação", icon: PackageCheck, group: "Dados" },
];
const moduleGroups: ModuleGroup[] = ["Visão geral", "Operação", "Dados"];

const initialOperations: Operation[] = [
  {
    id: "op-2026-07",
    name: "Operação Julho",
    client: "MK9 Trade",
    month: "07",
    year: "2026",
    status: "ATIVA",
    coverageGoal: 95,
  },
  {
    id: "op-2026-08",
    name: "Operação Agosto",
    client: "MK9 Trade",
    month: "08",
    year: "2026",
    status: "PLANEJADA",
    coverageGoal: 92,
  },
];

const initialStores: StoreItem[] = [
  { id: "store-1", code: "RJ-001", name: "Mercado Guanabara Centro", network: "Guanabara", city: "Rio de Janeiro", state: "RJ" },
  { id: "store-2", code: "SP-014", name: "Empório Paulista Norte", network: "Empório Paulista", city: "São Paulo", state: "SP" },
  { id: "store-3", code: "MG-008", name: "Super Minas Savassi", network: "Super Minas", city: "Belo Horizonte", state: "MG" },
  { id: "store-4", code: "RJ-019", name: "Rede Sul Barra", network: "Rede Sul", city: "Rio de Janeiro", state: "RJ" },
];

const initialPromoters: Promoter[] = [
  { id: "prom-1", name: "Ana Martins", supervisor: "Carla Souza", city: "Rio de Janeiro", active: true },
  { id: "prom-2", name: "Bruno Lima", supervisor: "Rafael Costa", city: "São Paulo", active: true },
  { id: "prom-3", name: "Camila Rocha", supervisor: "Carla Souza", city: "Belo Horizonte", active: true },
  { id: "prom-4", name: "Diego Nunes", supervisor: "Rafael Costa", city: "Rio de Janeiro", active: false },
];

const initialVisits: Visit[] = [
  { id: "visit-1", operationId: "op-2026-07", promoterId: "prom-1", storeId: "store-1", industry: "AO QUADRADO", plannedDate: "2026-07-22", status: "REALIZADA", evidence: "Checklist aprovado" },
  { id: "visit-2", operationId: "op-2026-07", promoterId: "prom-1", storeId: "store-4", industry: "KING CHECKLIST", plannedDate: "2026-07-24", status: "PLANEJADA" },
  { id: "visit-3", operationId: "op-2026-07", promoterId: "prom-2", storeId: "store-2", industry: "AO QUADRADO", plannedDate: "2026-07-23", status: "REALIZADA", evidence: "Evidência com data divergente" },
  { id: "visit-4", operationId: "op-2026-07", promoterId: "prom-3", storeId: "store-3", industry: "ROTEIRO PROMOTORES", plannedDate: "2026-07-21", status: "PLANEJADA" },
  { id: "visit-5", operationId: "op-2026-08", promoterId: "prom-2", storeId: "store-2", industry: "KING CHECKLIST", plannedDate: "2026-08-04", status: "PLANEJADA" },
];

const initialImports: ImportItem[] = [
  { id: "imp-1", fileName: "visitas_julho.xlsx", type: "ROTEIRO PROMOTORES", status: "PROCESSADO", validRows: 124, invalidRows: 3, duplicates: 8, createdAt: "2026-07-24 10:42" },
  { id: "imp-2", fileName: "evidencias_ao_quadrado.csv", type: "AO QUADRADO", status: "PENDENTE", validRows: 58, invalidRows: 6, duplicates: 2, createdAt: "2026-07-24 09:15" },
];

const chartColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function getField(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function statusVariant(status: OperationStatus | VisitStatus | ImportStatus) {
  if (status === "REALIZADA" || status === "PROCESSADO" || status === "ATIVA") return "default";
  if (status === "ERRO" || status === "CANCELADA") return "destructive";
  return "secondary";
}

export function Mk9AnalyticsApp() {
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [operations, setOperations] = useState<Operation[]>(initialOperations);
  const [stores, setStores] = useState<StoreItem[]>(initialStores);
  const [promoters, setPromoters] = useState<Promoter[]>(initialPromoters);
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [imports, setImports] = useState<ImportItem[]>(initialImports);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const activeOperation = operations.find((operation) => operation.status === "ATIVA") ?? operations[0];

  const metrics = useMemo(() => {
    const planned = visits.length;
    const completed = visits.filter((visit) => visit.status === "REALIZADA").length;
    const canceled = visits.filter((visit) => visit.status === "CANCELADA").length;
    const delayed = visits.filter(
      (visit) => visit.status === "PLANEJADA" && visit.plannedDate < todayIso(),
    ).length;
    const coverage = planned > 0 ? Math.round((completed / planned) * 100) : 0;
    const reconciliation = completed > 0 ? Math.round(((completed - 1) / completed) * 100) : 0;
    return { planned, completed, canceled, delayed, coverage, reconciliation };
  }, [visits]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const term = query.toLowerCase();
    return [
      ...operations.filter((item) => `${item.name} ${item.client}`.toLowerCase().includes(term)).map((item) => ({ type: "Operação", label: item.name })),
      ...stores.filter((item) => `${item.name} ${item.code} ${item.city}`.toLowerCase().includes(term)).map((item) => ({ type: "Loja", label: item.name })),
      ...promoters.filter((item) => `${item.name} ${item.supervisor}`.toLowerCase().includes(term)).map((item) => ({ type: "Promotor", label: item.name })),
    ].slice(0, 6);
  }, [operations, promoters, query, stores]);

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
                  <p className="mt-1 truncate font-medium">{activeOperation?.name ?? "Nenhuma operação"}</p>
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
                <div className="relative w-full md:w-[320px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar operações, lojas, promotores…"
                    className="h-10 rounded-lg border-border/70 bg-muted/50 pl-9 pr-16 text-sm shadow-none transition-all focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/25"
                    aria-label="Buscar no sistema"
                  />
                  <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-block">
                    ⌘K
                  </kbd>
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
                <span className="hidden items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--color-kpi-green)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-kpi-green)_10%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-kpi-green)] md:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-kpi-green)]" />
                  Produção
                </span>
                <button
                  aria-label="Notificações"
                  className="relative grid h-10 w-10 place-items-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[color:var(--color-kpi-amber)]" />
                </button>
                <button className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03]">
                  MK
                </button>
              </div>
            </div>
          </header>

          <div key={activeModule} className="animate-fade-up mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
            {activeModule === "dashboard" && (
              <DashboardModule
                metrics={metrics}
                operations={operations}
                stores={stores}
                promoters={promoters}
                visits={visits}
                imports={imports}
                onOpenModule={setActiveModule}
              />
            )}
            {activeModule === "operacoes" && <OperationsModule operations={operations} setOperations={setOperations} visits={visits} />}
            {activeModule === "lojas" && <StoresModule stores={stores} setStores={setStores} />}
            {activeModule === "promotores" && <PromotersModule promoters={promoters} setPromoters={setPromoters} />}
            {activeModule === "roteiros" && (
              <RoutesModule stores={stores} promoters={promoters} visits={visits} setVisits={setVisits} activeOperation={activeOperation} />
            )}
            {activeModule === "visitas" && (
              <VisitsModule visits={visits} setVisits={setVisits} stores={stores} promoters={promoters} operations={operations} />
            )}
            {activeModule === "importacoes" && <ImportsModule imports={imports} setImports={setImports} />}
            {activeModule === "conciliacao" && (
              <ReconciliationModule visits={visits} setVisits={setVisits} stores={stores} promoters={promoters} imports={imports} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardModule({
  metrics,
  operations,
  stores,
  promoters,
  visits,
  imports,
  onOpenModule,
}: {
  metrics: { planned: number; completed: number; canceled: number; delayed: number; coverage: number; reconciliation: number };
  operations: Operation[];
  stores: StoreItem[];
  promoters: Promoter[];
  visits: Visit[];
  imports: ImportItem[];
  onOpenModule: (module: ModuleId) => void;
}) {
  const visitsByStatus = [
    { name: "Realizadas", value: metrics.completed },
    { name: "Planejadas", value: Math.max(metrics.planned - metrics.completed - metrics.canceled, 0) },
    { name: "Canceladas", value: metrics.canceled },
  ];

  const executionByDay = ["20", "21", "22", "23", "24", "25"].map((day, index) => ({
    day: `${day}/07`,
    planejadas: 14 + index * 2,
    realizadas: 9 + index,
  }));

  const promoterRanking = promoters.map((promoter) => {
    const total = visits.filter((visit) => visit.promoterId === promoter.id).length;
    const done = visits.filter((visit) => visit.promoterId === promoter.id && visit.status === "REALIZADA").length;
    return { promoter, total, done };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Route} label="Visitas planejadas" value={metrics.planned} detail={`${metrics.completed} realizadas`} />
        <KpiCard icon={CheckCircle2} label="Cobertura" value={`${metrics.coverage}%`} detail="execução do período" />
        <KpiCard icon={AlertTriangle} label="Alertas críticos" value={metrics.delayed} detail="visitas atrasadas" />
        <KpiCard icon={FileSpreadsheet} label="Importações" value={imports.length} detail="arquivos analisados" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Execução diária</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={executionByDay} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Area type="monotone" dataKey="planejadas" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.16} />
                <Area type="monotone" dataKey="realizadas" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.24} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Status das visitas</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={visitsByStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>
                  {visitsByStatus.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ações rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button className="justify-start" onClick={() => onOpenModule("importacoes")}><Upload className="h-4 w-4" />Importar planilha</Button>
            <Button variant="secondary" className="justify-start" onClick={() => onOpenModule("roteiros")}><Route className="h-4 w-4" />Gerar roteiros</Button>
            <Button variant="outline" className="justify-start" onClick={() => onOpenModule("conciliacao")}><PackageCheck className="h-4 w-4" />Conciliar evidências</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cadastros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <SummaryLine label="Operações" value={operations.length} icon={ClipboardCheck} />
            <SummaryLine label="Lojas" value={stores.length} icon={Store} />
            <SummaryLine label="Promotores ativos" value={promoters.filter((item) => item.active).length} icon={Users} />
            <SummaryLine label="Conciliação" value={`${metrics.reconciliation}%`} icon={PackageCheck} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de promotores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {promoterRanking.map(({ promoter, total, done }) => (
              <div key={promoter.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{promoter.name}</span>
                  <span className="text-muted-foreground">{done}/{total}</span>
                </div>
                <div className="h-2 rounded-md bg-muted">
                  <div className="h-2 rounded-md bg-primary" style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, detail }: { icon: typeof BarChart3; label: string; value: string | number; detail: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-md bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryLine({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof BarChart3 }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" />{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function OperationsModule({ operations, setOperations, visits }: { operations: Operation[]; setOperations: Dispatch<SetStateAction<Operation[]>>; visits: Visit[] }) {
  function addOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = getField(form, "name");
    if (!name) return;
    const operation: Operation = {
      id: `op-${Date.now()}`,
      name,
      client: getField(form, "client") || "Cliente sem nome",
      month: getField(form, "month") || "01",
      year: getField(form, "year") || "2026",
      status: "PLANEJADA",
      coverageGoal: Number(getField(form, "goal")) || 90,
    };
    setOperations((current) => [operation, ...current]);
    event.currentTarget.reset();
  }

  function updateStatus(id: string, status: OperationStatus) {
    setOperations((current) => current.map((operation) => (operation.id === id ? { ...operation, status } : operation)));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle>Nova operação</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={addOperation}>
            <Input name="name" placeholder="Nome da operação" />
            <Input name="client" placeholder="Cliente" />
            <div className="grid grid-cols-3 gap-2">
              <Input name="month" placeholder="Mês" maxLength={2} />
              <Input name="year" placeholder="Ano" maxLength={4} />
              <Input name="goal" placeholder="Meta %" inputMode="numeric" />
            </div>
            <Button type="submit"><Plus className="h-4 w-4" />Criar operação</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {operations.map((operation) => {
          const totalVisits = visits.filter((visit) => visit.operationId === operation.id).length;
          return (
            <Card key={operation.id}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{operation.name}</h2>
                    <Badge variant={statusVariant(operation.status)}>{operation.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{operation.client} · {operation.month}/{operation.year} · meta {operation.coverageGoal}% · {totalVisits} visitas</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(operation.id, "ATIVA")}>Ativar</Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(operation.id, "FECHADA")}>Fechar</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StoresModule({ stores, setStores }: { stores: StoreItem[]; setStores: Dispatch<SetStateAction<StoreItem[]>> }) {
  const [filter, setFilter] = useState("");
  const filtered = stores.filter((store) => `${store.name} ${store.code} ${store.city} ${store.state}`.toLowerCase().includes(filter.toLowerCase()));

  function addStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = getField(form, "name");
    if (!name) return;
    setStores((current) => [{
      id: `store-${Date.now()}`,
      code: getField(form, "code") || `COD-${current.length + 1}`,
      name,
      network: getField(form, "network") || "Rede independente",
      city: getField(form, "city") || "Cidade",
      state: getField(form, "state") || "UF",
    }, ...current]);
    event.currentTarget.reset();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Cadastro de loja</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-6" onSubmit={addStore}>
            <Input name="code" placeholder="Código" />
            <Input name="name" placeholder="Nome" className="md:col-span-2" />
            <Input name="network" placeholder="Rede" />
            <Input name="city" placeholder="Cidade" />
            <Input name="state" placeholder="UF" maxLength={2} />
            <Button type="submit" className="md:col-span-6"><Plus className="h-4 w-4" />Adicionar loja</Button>
          </form>
        </CardContent>
      </Card>
      <DataToolbar value={filter} onChange={setFilter} placeholder="Filtrar lojas…" />
      <TableShell headers={["Código", "Loja", "Rede", "Cidade", "UF"]}>
        {filtered.map((store) => (
          <tr key={store.id} className="border-b last:border-0">
            <td className="p-3 font-medium">{store.code}</td>
            <td className="p-3">{store.name}</td>
            <td className="p-3 text-muted-foreground">{store.network}</td>
            <td className="p-3">{store.city}</td>
            <td className="p-3"><Badge variant="outline">{store.state}</Badge></td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

function PromotersModule({ promoters, setPromoters }: { promoters: Promoter[]; setPromoters: Dispatch<SetStateAction<Promoter[]>> }) {
  function addPromoter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = getField(form, "name");
    if (!name) return;
    setPromoters((current) => [{
      id: `prom-${Date.now()}`,
      name,
      supervisor: getField(form, "supervisor") || "Sem supervisor",
      city: getField(form, "city") || "Cidade",
      active: true,
    }, ...current]);
    event.currentTarget.reset();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle>Novo promotor</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={addPromoter}>
            <Input name="name" placeholder="Nome" />
            <Input name="supervisor" placeholder="Supervisor" />
            <Input name="city" placeholder="Cidade base" />
            <Button type="submit"><Plus className="h-4 w-4" />Adicionar promotor</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {promoters.map((promoter) => (
          <Card key={promoter.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{promoter.name}</h2>
                  <p className="text-sm text-muted-foreground">Supervisor: {promoter.supervisor}</p>
                  <p className="text-sm text-muted-foreground">Base: {promoter.city}</p>
                </div>
                <Badge variant={promoter.active ? "default" : "secondary"}>{promoter.active ? "ativo" : "inativo"}</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setPromoters((current) => current.map((item) => item.id === promoter.id ? { ...item, active: !item.active } : item))}
              >
                {promoter.active ? "Inativar" : "Ativar"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RoutesModule({ stores, promoters, visits, setVisits, activeOperation }: { stores: StoreItem[]; promoters: Promoter[]; visits: Visit[]; setVisits: Dispatch<SetStateAction<Visit[]>>; activeOperation?: Operation }) {
  const [selectedPromoter, setSelectedPromoter] = useState(promoters[0]?.id ?? "");
  const activePromoter = promoters.find((promoter) => promoter.id === selectedPromoter);
  const suggestedStores = stores.filter((store) => !activePromoter || store.city === activePromoter.city).slice(0, 3);

  function generateRoute() {
    if (!activeOperation || !selectedPromoter) return;
    const generated: Visit[] = suggestedStores.map((store, index) => ({
      id: `visit-${Date.now()}-${index}`,
      operationId: activeOperation.id,
      promoterId: selectedPromoter,
      storeId: store.id,
      industry: index % 2 === 0 ? "AO QUADRADO" : "KING CHECKLIST",
      plannedDate: `2026-07-${String(25 + index).padStart(2, "0")}`,
      status: "PLANEJADA",
    }));
    setVisits((current) => [...generated, ...current]);
  }

  const promoterVisits = visits.filter((visit) => visit.promoterId === selectedPromoter);

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle>Gerador de roteiro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="grid gap-1 text-sm font-medium">
            Promotor
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={selectedPromoter} onChange={(event) => setSelectedPromoter(event.target.value)}>
              {promoters.filter((promoter) => promoter.active).map((promoter) => <option key={promoter.id} value={promoter.id}>{promoter.name}</option>)}
            </select>
          </label>
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            {suggestedStores.length} lojas sugeridas pela cidade base do promotor.
          </div>
          <Button onClick={generateRoute} disabled={!activeOperation || suggestedStores.length === 0}><Route className="h-4 w-4" />Gerar visitas planejadas</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Roteiro semanal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {promoterVisits.map((visit) => (
              <RouteVisitCard key={visit.id} visit={visit} store={stores.find((store) => store.id === visit.storeId)} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RouteVisitCard({ visit, store }: { visit: Visit; store?: StoreItem }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-semibold">{shortDate(visit.plannedDate)}</p>
      <p className="mt-1 text-sm">{store?.name ?? "Loja não encontrada"}</p>
      <p className="text-xs text-muted-foreground">{visit.industry}</p>
      <Badge className="mt-3" variant={statusVariant(visit.status)}>{visit.status}</Badge>
    </div>
  );
}

function VisitsModule({ visits, setVisits, stores, promoters, operations }: { visits: Visit[]; setVisits: Dispatch<SetStateAction<Visit[]>>; stores: StoreItem[]; promoters: Promoter[]; operations: Operation[] }) {
  const [statusFilter, setStatusFilter] = useState<"TODAS" | VisitStatus>("TODAS");
  const filtered = statusFilter === "TODAS" ? visits : visits.filter((visit) => visit.status === statusFilter);

  function setVisitStatus(id: string, status: VisitStatus) {
    setVisits((current) => current.map((visit) => visit.id === id ? { ...visit, status, evidence: status === "REALIZADA" ? "Evidência registrada" : visit.evidence } : visit));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["TODAS", "PLANEJADA", "REALIZADA", "CANCELADA"] as const).map((status) => (
          <Button key={status} variant={statusFilter === status ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(status)}>{status}</Button>
        ))}
      </div>
      <TableShell headers={["Data", "Operação", "Promotor", "Loja", "Indústria", "Status", "Ações"]}>
        {filtered.map((visit) => {
          const store = stores.find((item) => item.id === visit.storeId);
          const promoter = promoters.find((item) => item.id === visit.promoterId);
          const operation = operations.find((item) => item.id === visit.operationId);
          return (
            <tr key={visit.id} className="border-b last:border-0">
              <td className="p-3">{shortDate(visit.plannedDate)}</td>
              <td className="p-3 text-muted-foreground">{operation?.name ?? "—"}</td>
              <td className="p-3">{promoter?.name ?? "—"}</td>
              <td className="p-3">{store?.name ?? "—"}</td>
              <td className="p-3 text-muted-foreground">{visit.industry}</td>
              <td className="p-3"><Badge variant={statusVariant(visit.status)}>{visit.status}</Badge></td>
              <td className="p-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setVisitStatus(visit.id, "REALIZADA")}>Realizar</Button>
                  <Button size="sm" variant="outline" onClick={() => setVisitStatus(visit.id, "CANCELADA")}>Cancelar</Button>
                </div>
              </td>
            </tr>
          );
        })}
      </TableShell>
    </div>
  );
}

function ImportsModule({ imports, setImports }: { imports: ImportItem[]; setImports: Dispatch<SetStateAction<ImportItem[]>> }) {
  function addImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const fileName = file instanceof File && file.name ? file.name : "planilha_operacional.xlsx";
    const type = getField(form, "type") || "ROTEIRO PROMOTORES";
    setImports((current) => [{
      id: `imp-${Date.now()}`,
      fileName,
      type,
      status: "PROCESSADO",
      validRows: 48 + current.length * 7,
      invalidRows: current.length % 4,
      duplicates: current.length % 3,
      createdAt: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date()),
    }, ...current]);
    event.currentTarget.reset();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Importar planilha</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]" onSubmit={addImport}>
            <Input name="file" type="file" accept=".csv,.xls,.xlsx" />
            <select name="type" className="h-9 rounded-md border bg-background px-3 text-sm">
              <option>ROTEIRO PROMOTORES</option>
              <option>AO QUADRADO</option>
              <option>KING CHECKLIST</option>
            </select>
            <Button type="submit"><Upload className="h-4 w-4" />Analisar</Button>
          </form>
        </CardContent>
      </Card>
      <TableShell headers={["Arquivo", "Tipo", "Status", "Válidos", "Inválidos", "Duplicados", "Criado em"]}>
        {imports.map((item) => (
          <tr key={item.id} className="border-b last:border-0">
            <td className="p-3 font-medium">{item.fileName}</td>
            <td className="p-3 text-muted-foreground">{item.type}</td>
            <td className="p-3"><Badge variant={statusVariant(item.status)}>{item.status}</Badge></td>
            <td className="p-3">{item.validRows}</td>
            <td className="p-3">{item.invalidRows}</td>
            <td className="p-3">{item.duplicates}</td>
            <td className="p-3 text-muted-foreground">{item.createdAt}</td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

function ReconciliationModule({ visits, setVisits, stores, promoters, imports }: { visits: Visit[]; setVisits: Dispatch<SetStateAction<Visit[]>>; stores: StoreItem[]; promoters: Promoter[]; imports: ImportItem[] }) {
  const diagnostics = visits.map((visit) => {
    const issue = visit.status === "REALIZADA" && visit.evidence?.includes("divergente")
      ? "DATE_MISMATCH"
      : visit.status === "PLANEJADA" && visit.plannedDate < todayIso()
        ? "UNPLANNED"
        : "MATCHED";
    return { visit, issue };
  });

  function reconcile(id: string) {
    setVisits((current) => current.map((visit) => visit.id === id ? { ...visit, status: "REALIZADA", evidence: "Conciliado manualmente" } : visit));
  }

  const chartData = [
    { name: "MATCHED", total: diagnostics.filter((item) => item.issue === "MATCHED").length },
    { name: "DATE_MISMATCH", total: diagnostics.filter((item) => item.issue === "DATE_MISMATCH").length },
    { name: "UNPLANNED", total: diagnostics.filter((item) => item.issue === "UNPLANNED").length },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader><CardTitle>Diagnóstico</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 10, top: 10, bottom: 10 }}>
                <CartesianGrid stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                <Bar dataKey="total" fill="var(--color-chart-3)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Último arquivo analisado</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-semibold">{imports[0]?.fileName ?? "Nenhuma importação"}</p>
            <p className="text-sm text-muted-foreground">As evidências são comparadas com visitas planejadas por promotor, loja, indústria e data.</p>
            <div className="grid gap-2 md:grid-cols-3">
              {chartData.map((item) => <SummaryLine key={item.name} label={item.name} value={item.total} icon={PackageCheck} />)}
            </div>
          </CardContent>
        </Card>
      </div>
      <TableShell headers={["Visita", "Promotor", "Loja", "Diagnóstico", "Ação"]}>
        {diagnostics.map(({ visit, issue }) => {
          const store = stores.find((item) => item.id === visit.storeId);
          const promoter = promoters.find((item) => item.id === visit.promoterId);
          return (
            <tr key={visit.id} className="border-b last:border-0">
              <td className="p-3">{shortDate(visit.plannedDate)} · {visit.industry}</td>
              <td className="p-3">{promoter?.name ?? "—"}</td>
              <td className="p-3">{store?.name ?? "—"}</td>
              <td className="p-3"><Badge variant={issue === "MATCHED" ? "default" : "secondary"}>{issue}</Badge></td>
              <td className="p-3"><Button size="sm" variant="outline" disabled={issue === "MATCHED"} onClick={() => reconcile(visit.id)}>Reprocessar</Button></td>
            </tr>
          );
        })}
      </TableShell>
    </div>
  );
}

function DataToolbar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

function TableShell({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              {headers.map((header) => <th key={header} className="p-3 font-medium">{header}</th>)}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}