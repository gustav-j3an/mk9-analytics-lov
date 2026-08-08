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
import { Mk9DashboardModule } from "@/components/mk9-dashboard-module";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  mk9ListIndustries,
  mk9ListStores,
  mk9ListPromoters,
} from "@/lib/mk9-data.functions";

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
  | "promotores";

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
    <main className="min-h-screen w-full bg-[#080812] text-foreground flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-[#111122] border-r border-white/5 transition-all duration-300 flex flex-col shrink-0 z-20",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-white/5 bg-command-deep/50">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-command-purple flex items-center justify-center shadow-lg shadow-purple-500/20">
                <ShieldCheck className="text-white h-5 w-5" />
              </div>
              <span className="font-black tracking-tighter text-lg text-white">MK9 <span className="text-command-purple">COMMAND</span></span>
            </div>
          )}
          {collapsed && <ShieldCheck className="mx-auto text-command-purple h-6 w-6" />}
        </div>

        <div className="flex-1 overflow-y-auto py-6">
          <nav className="px-3 space-y-1">
            <SidebarItem
              icon={BarChart3}
              label="Dashboard"
              active={activeModule === "dashboard"}
              onClick={() => setActiveModule("dashboard")}
            />
            <SidebarItem
              icon={Gauge}
              label="Cockpit"
              active={activeModule === "cockpit"}
              onClick={() => setActiveModule("cockpit")}
            />
            <SidebarItem
              icon={ClipboardCheck}
              label="Conciliação"
              active={activeModule === "conciliacao"}
              onClick={() => setActiveModule("conciliacao")}
            />
            <SidebarItem
              icon={PackageCheck}
              label="Qualidade"
              active={activeModule === "qualidade"}
              onClick={() => setActiveModule("qualidade")}
            />
            <SidebarItem
              icon={Factory}
              label="Central de Relatórios"
              active={activeModule === "relatorio_industria"}
              onClick={() => setActiveModule("relatorio_industria")}
            />
            <div className="pt-4 pb-2">
              {!collapsed && <p className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 opacity-80">Cadastros</p>}
            </div>
            <SidebarItem
              icon={Factory}
              label="Indústrias"
              active={activeModule === "industrias"}
              onClick={() => setActiveModule("industrias")}
            />
            <SidebarItem
              icon={Store}
              label="Lojas"
              active={activeModule === "lojas"}
              onClick={() => setActiveModule("lojas")}
            />
            <SidebarItem
              icon={Users}
              label="Promotores"
              active={activeModule === "promotores"}
              onClick={() => setActiveModule("promotores")}
            />

            <div className="pt-4 pb-2">
              {!collapsed && <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">Operação</p>}
            </div>
            <SidebarItem
              icon={Settings2}
              label="Gestão Operacional"
              active={activeModule === "importacoes"}
              onClick={() => setActiveModule("importacoes")}
            />
            <SidebarItem
              icon={Upload}
              label="Importar Checklist"
              active={activeModule === "checklists"}
              onClick={() => setActiveModule("checklists")}
            />
            <SidebarItem
              icon={Route}
              label="Roteiros"
              active={activeModule === "roteiros"}
              onClick={() => setActiveModule("roteiros")}
            />
            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  {!collapsed && <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">Administração</p>}
                </div>
                <SidebarItem
                  icon={ShieldCheck}
                  label="Homologação"
                  active={activeModule === "homologacao"}
                  onClick={() => setActiveModule("homologacao")}
                />
                <SidebarItem
                  icon={ShieldAlert}
                  label="Limpeza Manual"
                  active={activeModule === "cleanup_admin"}
                  onClick={() => setActiveModule("cleanup_admin")}
                />
                <SidebarItem
                  icon={Users}
                  label="Usuários"
                  active={activeModule === "usuarios"}
                  onClick={() => setActiveModule("usuarios")}
                />
              </>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-white/5 space-y-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn("w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg", collapsed && "justify-center px-0")}
          >
            {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            {!collapsed && <span className="text-sm font-bold uppercase tracking-tighter">Recolher</span>}
          </button>
          <button
            className={cn("w-full flex items-center gap-3 px-4 py-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors rounded-lg", collapsed && "justify-center px-0")}
            onClick={() => signOut()}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="text-sm font-bold uppercase tracking-tighter">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#080812]">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-command-deep/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-command-purple animate-pulse" />
              {activeModule === "dashboard" && "Dashboard Operacional"}
              {activeModule === "cockpit" && "Cockpit de Comando"}
              {activeModule === "importacoes" && "Gestão Operacional"}
              {activeModule === "industrias" && "Gestão de Indústrias"}
              {activeModule === "lojas" && "Gestão de Lojas"}
              {activeModule === "promotores" && "Gestão de Promotores"}
              {activeModule === "checklists" && "Importador de Checklists"}
              {activeModule === "conciliacao" && "Conciliação de Visitas"}
              {activeModule === "qualidade" && "Centro de Qualidade"}
              {activeModule === "roteiros" && "Roteiros & Frequências"}
              {activeModule === "relatorio_industria" && "Central de Relatórios"}
              {activeModule === "cleanup_admin" && "Limpeza Administrativa"}
              {activeModule === "homologacao" && "Saúde do Sistema"}
              {activeModule === "usuarios" && "Gestão de Acessos"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/5">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-28 h-7 border-none bg-transparent shadow-none focus:ring-0 text-[10px] font-bold text-white uppercase tracking-tighter">
                  <Calendar className="h-3 w-3 mr-1.5 text-command-purple" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-command-deep border-white/10 text-white text-xs">
                  {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="w-[1px] h-3 bg-white/10" />
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-16 h-7 border-none bg-transparent shadow-none focus-visible:ring-0 text-[10px] font-bold text-white text-center"
              />
            </div>
            {user && (
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-white truncate max-w-[100px] uppercase tracking-tighter">{user.email?.split("@")[0]}</span>
                  <Badge variant="outline" className="text-[8px] py-0 px-1 border-command-purple/30 bg-command-purple/10 text-command-purple font-black">
                    {isAdmin ? "ADMIN" : isSupervisor ? "SUPERVISOR" : isAuditor ? "AUDITOR" : "USER"}
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
          <div className="p-8">
            {activeModule === "dashboard" && <Mk9DashboardModule />}
            {activeModule === "cockpit" && <Mk9CockpitModule />}
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
              <Mk9ChecklistImportModule onSwitchToBase={() => setActiveModule("importacoes")} />
            )}
            {activeModule === "conciliacao" && <Mk9AuditModule key={auditKey} initialFilters={auditFilters} />}
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

            {activeModule === "relatorio_industria" && <Mk9IndustryReportModule />}
            {activeModule === "cleanup_admin" && <Mk9AdminCleanupModule month={month} year={year} />}
            {activeModule === "homologacao" && <Mk9HomologationModule />}
            
            {activeModule === "usuarios" && <Mk9UsersModule currentUserId={user?.id ?? null} />}
          </div>
        </section>
      </div>
    </main>
  );
}

function SidebarItem({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 relative group",
        active
          ? "bg-command-purple/10 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)] neon-border-purple"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", active ? "text-command-purple" : "text-slate-500")} />
      <span className="truncate">{label}</span>
      {active && (
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-command-purple shadow-[0_0_8px_#A855F7]" />
      )}
    </button>
  );
}
