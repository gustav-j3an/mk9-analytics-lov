import { useMemo, useState } from "react";
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
import { Mk9HomologationModule } from "./mk9-homologation-module";
import { Mk9IndustryAuditModule } from "./mk9-industry-audit-module";

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
  | "auditoria_controle";

export function Mk9AnalyticsApp() {
  const { user, roles, loading: sessionLoading, signOut } = useMk9Session();
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
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
    <main className="min-h-screen w-full bg-[#080812] text-foreground flex flex-col md:flex-row overflow-hidden font-sans dark">
      {/* Mobile Top Header */}
      <div className="md:hidden h-14 shrink-0 bg-[#111122] border-b border-white/5 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-command-purple flex items-center justify-center shadow-lg shadow-purple-500/20">
            <ShieldCheck className="text-white h-4 w-4" />
          </div>
          <span className="font-black tracking-tighter text-sm text-white">MK9</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white"
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
          "bg-[#111122] border-r border-white/5 transition-all duration-300 flex flex-col shrink-0 z-30",
          "fixed inset-y-0 left-0 md:relative",
          collapsed ? "-translate-x-full md:translate-x-0 md:w-20" : "translate-x-0 w-64",
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-white/5 bg-command-deep/50">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-command-purple flex items-center justify-center shadow-lg shadow-purple-500/20">
                <ShieldCheck className="text-white h-5 w-5" />
              </div>
              <span className="font-black tracking-tighter text-lg text-white">
                MK9 <span className="text-command-purple">COMMAND</span> <span className="text-[8px] opacity-30 ml-1">v1.1.2</span>
              </span>
            </div>
          )}
          {collapsed && <ShieldCheck className="mx-auto text-command-purple h-6 w-6" />}
        </div>

        <div className="flex-1 overflow-y-auto py-6">
          <nav className="px-3 space-y-1">
            <div className="pt-2 pb-2">
              {!collapsed && (
                <p className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 opacity-60">
                  Visão Geral
                </p>
              )}
            </div>
            <SidebarItem
              icon={BarChart3}
              label="Dashboard"
              active={activeModule === "dashboard"}
              onClick={() => {
                setActiveModule("dashboard");
                if (window.innerWidth < 768) setCollapsed(true);
              }}
            />
            <SidebarItem
              icon={Gauge}
              label="Cockpit"
              active={activeModule === "cockpit"}
              onClick={() => {
                setActiveModule("cockpit");
                if (window.innerWidth < 768) setCollapsed(true);
              }}
            />
            <SidebarItem
              icon={Layers}
              label="Inteligência"
              active={activeModule === "dashboard"}
              onClick={() => {
                setActiveModule("dashboard");
                if (window.innerWidth < 768) setCollapsed(true);
              }}
            />

            <div className="pt-4 pb-2">
              {!collapsed && (
                <p className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 opacity-60">
                  Operação
                </p>
              )}
            </div>
            <SidebarItem
              icon={Settings2}
              label="Gestão Operacional"
              active={activeModule === "importacoes"}
              onClick={() => {
                setActiveModule("importacoes");
                if (window.innerWidth < 768) setCollapsed(true);
              }}
            />
            <SidebarItem
              icon={Upload}
              label="Importar Checklist"
              active={activeModule === "checklists"}
              onClick={() => {
                setActiveModule("checklists");
                if (window.innerWidth < 768) setCollapsed(true);
              }}
            />
            <SidebarItem
              icon={Route}
              label="Roteiros"
              active={activeModule === "roteiros"}
              onClick={() => {
                setActiveModule("roteiros");
                if (window.innerWidth < 768) setCollapsed(true);
              }}
            />

            <div className="pt-4 pb-2">
              {!collapsed && (
                <p className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 opacity-60">
                  Análise e Controle
                </p>
              )}
            </div>
            <SidebarItem
              icon={ClipboardCheck}
              label="Conciliação"
              active={activeModule === "conciliacao"}
              onClick={() => {
                setActiveModule("conciliacao");
                if (window.innerWidth < 768) setCollapsed(true);
              }}
            />
            <SidebarItem
              icon={PackageCheck}
              label="Qualidade"
              active={activeModule === "qualidade"}
              onClick={() => {
                setActiveModule("qualidade");
                if (window.innerWidth < 768) setCollapsed(true);
              }}
            />
            <SidebarItem
              icon={FileSpreadsheet}
              label="Indústrias (PDF)"
              active={activeModule === "relatorio_industria"}
              onClick={() => {
                setActiveModule("relatorio_industria");
                if (window.innerWidth < 768) setCollapsed(true);
              }}
            />

            <div className="pt-4 pb-2">
              {!collapsed && (
                <p className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 opacity-60">
                  Cadastros
                </p>
              )}
            </div>
            <SidebarItem
              icon={Factory}
              label="Indústrias"
              active={activeModule === "industrias"}
                  onClick={() => {
                    setActiveModule("industrias");
                    if (window.innerWidth < 768) setCollapsed(true);
                  }}
            />
            <SidebarItem
              icon={Store}
              label="Lojas"
              active={activeModule === "lojas"}
                  onClick={() => {
                    setActiveModule("lojas");
                    if (window.innerWidth < 768) setCollapsed(true);
                  }}
            />
            <SidebarItem
              icon={Users}
              label="Promotores"
              active={activeModule === "promotores"}
                  onClick={() => {
                    setActiveModule("promotores");
                    if (window.innerWidth < 768) setCollapsed(true);
                  }}
            />

            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  {!collapsed && (
                    <p className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 opacity-60">
                      Administração
                    </p>
                  )}
                </div>
                <SidebarItem
                  icon={ShieldAlert}
                  label="Limpeza Manual"
                  active={activeModule === "cleanup_admin"}
                  onClick={() => {
                    setActiveModule("cleanup_admin");
                    if (window.innerWidth < 768) setCollapsed(true);
                  }}
                />
                <SidebarItem
                  icon={Users}
                  label="Usuários"
                  active={activeModule === "usuarios"}
                  onClick={() => {
                    setActiveModule("usuarios");
                    if (window.innerWidth < 768) setCollapsed(true);
                  }}
                />
                <SidebarItem
                  icon={ShieldCheck}
                  label="Auditoria Controle"
                  active={activeModule === "auditoria_controle"}
                  onClick={() => {
                    setActiveModule("auditoria_controle");
                    if (window.innerWidth < 768) setCollapsed(true);
                  }}
                />
              </>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-white/5 space-y-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-5 w-5" />
            ) : (
              <ChevronsLeft className="h-5 w-5" />
            )}
            {!collapsed && (
              <span className="text-sm font-bold uppercase tracking-tighter">Recolher</span>
            )}
          </button>
          <button
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors rounded-lg",
              collapsed && "justify-center px-0",
            )}
            onClick={() => signOut()}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && (
              <span className="text-sm font-bold uppercase tracking-tighter">Sair</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#080812]">
        <header className="h-16 md:h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-command-deep/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-command-purple animate-pulse" />
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
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 md:gap-2 bg-white/5 p-1 rounded-lg border border-white/5">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-24 md:w-32 h-7 border-none bg-transparent shadow-none focus:ring-0 text-[9px] md:text-[10px] font-bold text-white uppercase tracking-tighter shrink-0 px-1 md:px-2 gap-0.5 md:gap-1">
                  <Calendar className="h-3 w-3 mr-1.5 text-command-purple" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-command-deep border-white/10 text-white text-xs">
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
                className="w-12 md:w-16 h-7 border-none bg-transparent shadow-none focus-visible:ring-0 text-[9px] md:text-[10px] font-bold text-white text-center shrink-0 p-0"
                min={2000}
                max={2099}
              />
            </div>
            {user && (
              <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-white/10">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[9px] md:text-[10px] font-black text-white truncate max-w-[60px] md:max-w-[100px] uppercase tracking-tighter">
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
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 relative group",
        active
          ? "bg-command-purple/10 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)] neon-border-purple"
          : "text-slate-400 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
          active ? "text-command-purple" : "text-slate-500",
        )}
      />
      <span className="truncate">{label}</span>
      {active && (
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-command-purple shadow-[0_0_8px_#A855F7]" />
      )}
    </button>
  );
}
