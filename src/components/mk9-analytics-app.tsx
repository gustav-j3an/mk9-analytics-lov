import { useMemo, useState, useEffect } from "react";
import { ThemeSettings } from "@/lib/mk9-theme/ThemeToggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mk9ImportModule } from "@/components/mk9-import-module";
import { Mk9ChecklistImportModule } from "@/components/mk9-checklist-import-module";
import { Mk9AuditModule, type Mk9AuditInitialFilters } from "@/components/mk9-audit-module";
import { Mk9QualityModule } from "@/components/mk9-quality-module";
import { Gauge, Settings2 } from "lucide-react";
import { Mk9CockpitModule } from "@/components/mk9-cockpit-module";
import type { ResolvedNavigation } from "@/lib/mk9-quality/evidence-view";
import { Mk9AnalyticsDashboard } from "@/components/mk9-analytics-dashboard";
import { Mk9RoutesModule } from "@/components/mk9-routes-module";
import { Mk9IndustryReportModule } from "@/components/mk9-industry-report-module";
import { Mk9UsersModule } from "@/components/mk9-users-module";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { toast } from "sonner";
import { Mk9AdminCleanupModule } from "@/components/mk9-admin-cleanup-module";
import { Mk9IndustriesModule } from "./mk9-industries-module";
import { Mk9StoresModule } from "./mk9-stores-module";
import { Mk9PromotersModule } from "./mk9-promoters-module";
import { Mk9SupervisorsModule } from "./mk9-supervisors-module";
import { Mk9HomologationModule } from "./mk9-homologation-module";
import { Mk9IndustryAuditModule } from "./mk9-industry-audit-module";
import { Mk9PresenceModule } from "./mk9-presence-module";
import { UserCheck, WalletCards } from "lucide-react";
import { Mk9FreelancersModule } from "./mk9-freelancers-module";
import { Mk9DailiesModule } from "./mk9-dailies-module";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";


import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  FileSpreadsheet,
  Factory,
  Loader2,
  LogOut,
  PackageCheck,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  Upload,
  Users,
  Layers,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { mk9ListIndustries, mk9ListStores, mk9ListPromoters } from "@/lib/mk9-data.functions";

type ModuleId =
  | "dashboard"
  | "cockpit"
  | "importacoes"
  // | "homologacao"
  | "homologacao"
  | "checklists"
  | "conciliacao"
  | "qualidade"
  | "roteiros"
  | "relatorio_industria"
  | "cleanup_admin"
  | "usuarios"
  | "industrias"
  | "lojas"
  | "promotores"
  | "supervisores"
  | "presenca"
  | "freelancers"
  | "diarias"
  | "auditoria_controle";


export function Mk9AnalyticsApp() {
  const { user, roles, loading: sessionLoading, signOut } = useMk9Session();
  const queryClient = useQueryClient();
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mk9_sidebar_collapsed");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("mk9_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [auditFilters, setAuditFilters] = useState<Mk9AuditInitialFilters>({});
  const [auditKey, setAuditKey] = useState(0);


  const isAdmin = roles.includes("ADMIN");
  const isSupervisor = roles.includes("SUPERVISOR");
  const isAuditor = roles.includes("AUDITOR");

  const listIndustriesFn = useServerFn(mk9ListIndustries);
  const listStoresFn = useServerFn(mk9ListStores);
  const listPromotersFn = useServerFn(mk9ListPromoters);

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => listIndustriesFn() });
  const storesQ = useQuery({ queryKey: ["mk9-stores"], queryFn: () => listStoresFn() });
  const promotersQ = useQuery({ queryKey: ["mk9-promoters"], queryFn: () => listPromotersFn() });

  if (sessionLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
    <main className="min-h-screen w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Mobile Top Header */}
      <div className="md:hidden h-14 shrink-0 bg-card border-b border-border flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shadow-lg glow-primary">
            <ShieldCheck className="text-foreground dark:text-foreground h-4 w-4" />
          </div>
          <span className="font-black tracking-tighter text-sm text-foreground">MK9</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {!collapsed && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-20"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar */}
        <aside
          className={cn(
            "bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col shrink-0 z-30 fixed inset-y-0 left-0 md:relative",
            collapsed ? "-translate-x-full md:translate-x-0 md:w-20" : "translate-x-0 w-64",
          )}
        >
          <div className={cn(
            "h-16 flex items-center border-b border-border bg-background/50 shrink-0 transition-all duration-300",
            collapsed ? "justify-center gap-1 px-2" : "justify-between px-4"
          )}>
              <div className={cn("flex items-center gap-2 overflow-hidden transition-all duration-300", collapsed && "w-8 shrink-0")}>
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-lg glow-primary shrink-0">
                  <ShieldCheck className="text-foreground dark:text-foreground h-5 w-5" />
                </div>
                {!collapsed && (
                  <span className="font-black tracking-tighter text-lg text-foreground whitespace-nowrap logo-mk9-text">
                    MK9 <span className="text-primary">COMMAND</span>
                  </span>
                )}
              </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent transition-colors"
              aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            >
              {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 custom-scrollbar">
            <nav className="px-3 space-y-6">
              {[
                { title: "Visão Geral", items: [
                  { id: "dashboard", icon: BarChart3, label: "Dashboard" },
                  { id: "cockpit", icon: Gauge, label: "Cockpit" },
                  { id: "dashboard", icon: Layers, label: "Inteligência" },
                ]},
                { title: "Operação", items: [
                  { id: "importacoes", icon: Settings2, label: "Gestão Operacional" },
                  { id: "checklists", icon: Upload, label: "Importar Checklist" },
                  { id: "roteiros", icon: Route, label: "Roteiros" },
                  { id: "presenca", icon: CheckCircle2, label: "Presença" },
                  { id: "diarias", icon: WalletCards, label: "Controle de Diárias" },
                ]},
                { title: "Análise e Controle", items: [
                  { id: "conciliacao", icon: ClipboardCheck, label: "Conciliação" },
                  { id: "qualidade", icon: PackageCheck, label: "Qualidade" },
                  { id: "relatorio_industria", icon: FileSpreadsheet, label: "Indústrias (PDF)" },
                ]},
                { title: "Cadastros", items: [
                  { id: "industrias", icon: Factory, label: "Indústrias" },
                  { id: "lojas", icon: Store, label: "Lojas" },
                  { id: "supervisores", icon: UserCheck, label: "Supervisores" },
                  { id: "promotores", icon: Users, label: "Promotores" },
                  { id: "freelancers", icon: UserCheck, label: "Freelancers" },
                ]},
                isAdmin && { title: "Administração", items: [
                  { id: "cleanup_admin", icon: ShieldAlert, label: "Limpeza Manual" },
                  { id: "usuarios", icon: Users, label: "Usuários" },
                  { id: "auditoria_controle", icon: ShieldCheck, label: "Auditoria Controle" },
                ]}
              ].filter(Boolean).map((cat: any, i) => (
                <div key={i} className="space-y-1">
                  {!collapsed && (
                    <p className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
                      {cat.title}
                    </p>
                  )}
                  {cat.items.map((item: any) => (
                    <SidebarItem
                      key={item.id + item.label}
                      icon={item.icon}
                      label={item.label}
                      active={activeModule === item.id}
                      collapsed={collapsed}
                      onClick={() => {
                        setActiveModule(item.id);
                        if (window.innerWidth < 768) setCollapsed(true);
                      }}
                    />
                  ))}
                </div>
              ))}
            </nav>
          </div>

          <div className="p-4 border-t border-border/50 shrink-0">
            <button
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors rounded-lg",
                collapsed && "justify-center px-0",
              )}
              onClick={() => signOut()}
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
              {!collapsed && (
                <span className="text-sm font-bold uppercase tracking-tighter">Sair</span>
              )}
            </button>
          </div>
        </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="h-16 md:h-20 border-b border-border flex items-center justify-between px-4 md:px-8 bg-background/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {activeModule === "dashboard" && "Dashboard"}
              {activeModule === "cockpit" && "Cockpit"}
              {activeModule === "importacoes" && "Gestão"}
              {activeModule === "industrias" && "Indústrias"}
              {activeModule === "lojas" && "Lojas"}
              {activeModule === "promotores" && "Promotores"}
              {activeModule === "checklists" && "Checklists"}
              {activeModule === "conciliacao" && "Conciliação"}
              {activeModule === "qualidade" && "Qualidade"}
              {activeModule === "roteiros" && "Roteiros"}
              {activeModule === "relatorio_industria" && "Relatórios"}
              {activeModule === "cleanup_admin" && "Admin"}
              {activeModule === "homologacao" && "Saúde"}
              {activeModule === "usuarios" && "Usuários"}
              {activeModule === "auditoria_controle" && "Auditoria"}
              {activeModule === "presenca" && "Presença"}

            </h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSettings />
            <div className="flex items-center gap-1 md:gap-2 bg-muted/50 p-1 rounded-lg border border-border/50">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-24 md:w-32 h-7 border-none bg-transparent shadow-none focus:ring-0 text-[9px] md:text-[10px] font-bold text-foreground uppercase tracking-tighter shrink-0 px-1 md:px-2 gap-0.5 md:gap-1">
                  <Calendar className="h-3 w-3 mr-1.5 text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground text-xs">
                  {[
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
                  ].map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-12 md:w-16 h-7 border-none bg-transparent shadow-none focus-visible:ring-0 text-[9px] md:text-[10px] font-bold text-foreground text-center shrink-0 p-0"
                min={2000}
                max={2099}
              />
            </div>
            {user && (
              <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-border">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[9px] md:text-[10px] font-black text-foreground truncate max-w-[60px] md:max-w-[100px] uppercase tracking-tighter">
                    {user.email?.split("@")[0]}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[8px] py-0 px-1 border-command-purple/30 bg-command-purple/10 text-command-purple font-black"
                  >
                    {isAdmin
                      ? "ADMIN"
                      : isSupervisor
                        ? "SUPERVISOR"
                        : isAuditor
                          ? "AUDITOR"
                          : "USER"}
                  </Badge>
                </div>
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-command-purple to-command-blue flex items-center justify-center text-white font-black text-xs shadow-lg shadow-purple-500/20">
                  {user.email?.[0].toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </header>

        <section className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="p-4 md:p-8">
            {activeModule === "dashboard" && (
              <Mk9AnalyticsDashboard initialMonth={month} initialYear={year} />
            )}
            {activeModule === "cockpit" && <Mk9CockpitModule initialMonth={month} initialYear={year} />}
            {activeModule === "importacoes" && (
              <Mk9ImportModule onSwitchToChecklists={() => setActiveModule("checklists")} />
            )}
            {activeModule === "industrias" && <Mk9IndustriesModule />}
            {activeModule === "lojas" && <Mk9StoresModule />}
            {activeModule === "promotores" && <Mk9PromotersModule />}
            {activeModule === "supervisores" && <Mk9SupervisorsModule />}
        {activeModule === "presenca" && <Mk9PresenceModule />}
        {activeModule === "diarias" && <Mk9DailiesModule />}
        {activeModule === "freelancers" && <Mk9FreelancersModule />}

            {activeModule === "roteiros" && (
              <Mk9RoutesModule
                promoters={promotersQ.data ?? []}
                stores={storesQ.data ?? []}
                industries={industriesQ.data ?? []}
              />
            )}
            {activeModule === "checklists" && (
              <Mk9ChecklistImportModule
                onSwitchToBase={() => setActiveModule("importacoes")}
                initialMonth={month}
                initialYear={year}
              />
            )}
            {activeModule === "conciliacao" && (
              <Mk9AuditModule
                key={auditKey}
                initialFilters={{ ...auditFilters, month, year }}
              />
            )}
            {activeModule === "qualidade" && (
              <Mk9QualityModule
                month={month}
                year={year}
                onNavigate={(target: ResolvedNavigation) => {
                  if (target.month) setMonth(target.month);
                  if (target.year) setYear(target.year);
                  if (target.module === "audit") {
                    setAuditFilters({
                      month: target.month ?? month,
                      year: target.year ?? year,
                      industryId: target.industryId ?? null,
                    });
                    setAuditKey((k) => k + 1);
                    setActiveModule("conciliacao");
                    return;
                  }
                  const map: Record<string, ModuleId> = {
                    stores: "importacoes",
                    routes: "roteiros",
                    frequency: "roteiros",
                    imports: "importacoes",
                    checklists: "checklists",
                    industries: "importacoes",
                    reports: "relatorio_industria",
                  };
                  setActiveModule(map[target.module] ?? "dashboard");
                }}
              />
            )}

            {activeModule === "relatorio_industria" && (
              <Mk9IndustryReportModule initialMonth={month} initialYear={year} />
            )}
            {activeModule === "cleanup_admin" && (
              <Mk9AdminCleanupModule month={month} year={year} />
            )}
            {activeModule === "homologacao" && <Mk9HomologationModule />}

            {activeModule === "usuarios" && <Mk9UsersModule currentUserId={user?.id ?? null} />}
            {activeModule === "auditoria_controle" && <Mk9IndustryAuditModule />}
          </div>
        </section>
      </div>
    </main>
    </TooltipProvider>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: any;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const content = (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 relative group",
        active
          ? "bg-command-purple/10 text-foreground dark:text-white shadow-[0_0_20px_rgba(168,85,247,0.15)] neon-border-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:text-white",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 transition-transform duration-300 group-hover:scale-110 shrink-0",
          active ? "text-command-purple" : "text-muted-foreground",
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && active && (
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-command-purple shadow-[0_0_8px_#A855F7]" />
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="bg-popover border-border text-popover-foreground">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
