/**
 * MK9 — Centro de Qualidade dos Dados (Fase Command Center).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CircleAlert,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Search,
  Filter,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMk9Session } from "@/lib/mk9-auth/session";
import {
  mk9QualityDetailFn,
  mk9QualityFacetsFn,
  mk9QualityFollowUpFn,
  mk9QualityListFn,
  mk9QualityOverviewFn,
  mk9QualityRunFn,
} from "@/lib/mk9-quality.functions";

import {
  MONTHS_PT,
  competenceLabel,
  dateTimeLabel,
  relativeLabel,
  sortIssues,
  issueTypeLabel,
} from "@/lib/mk9-quality/labels";
import { type ResolvedNavigation } from "@/lib/mk9-quality/evidence-view";
import type {
  Mk9QualityCategory,
  Mk9QualityIssueView,
  Mk9QualitySeverity,
  Mk9QualityStatus,
} from "@/lib/mk9-quality/types";

import { 
  Mk9PageHeader, 
  Mk9MetricCard, 
  Mk9Panel, 
  Mk9Badge, 
  Mk9LoadingState, 
  Mk9ErrorState,
  Mk9EmptyState 
} from "./mk9/design-system";

const PAGE_SIZE = 25;
const ALL = "__ALL__";

export function Mk9QualityModule({ month, year, onNavigate }: { month: number; year: number; onNavigate?: (t: ResolvedNavigation) => void }) {
  const queryClient = useQueryClient();
  const { roles } = useMk9Session();
  
  const [filters, setFilters] = useState({
    search: "",
    category: ALL,
    issueType: ALL,
    severity: ALL,
    status: "__OPEN__",
    industryId: ALL,
    uf: ALL,
    month,
    year,
    page: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const overviewFn = useServerFn(mk9QualityOverviewFn);
  const listFn = useServerFn(mk9QualityListFn);
  const runFn = useServerFn(mk9QualityRunFn);

  const overviewQ = useQuery({
    queryKey: ["mk9-quality-overview", filters.month, filters.year],
    queryFn: () => overviewFn({ data: { month: filters.month, year: filters.year } }),
  });

  const listQ = useQuery({
    queryKey: ["mk9-quality-list", filters],
    queryFn: () =>
      listFn({
        data: {
          month: filters.month,
          year: filters.year,
          status: filters.status === "__OPEN__" ? ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"] : [filters.status as any],
          category: filters.category === ALL ? null : (filters.category as Mk9QualityCategory),
          severity: filters.severity === ALL ? null : (filters.severity as Mk9QualitySeverity),
          issueType: filters.issueType === ALL ? null : filters.issueType,
          industryId: filters.industryId === ALL ? null : filters.industryId,
          uf: filters.uf === ALL ? null : filters.uf,
          search: filters.search || null,
          page: filters.page,
          pageSize: PAGE_SIZE,
        },
      }),
  });

  async function handleRun() {
    setRunning(true);
    try {
      await runFn({ data: { month: filters.month, year: filters.year } });
      await queryClient.invalidateQueries({ queryKey: ["mk9-quality-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["mk9-quality-list"] });
    } finally {
      setRunning(false);
    }
  }

  const overview = overviewQ.data;
  const items = useMemo(() => sortIssues((listQ.data?.items ?? []) as Mk9QualityIssueView[]), [listQ.data]);

  if (overviewQ.isLoading) return <Mk9LoadingState message="Analisando integridade dos dados..." />;
  if (overviewQ.isError) return <Mk9ErrorState message="Falha ao carregar central de qualidade." onRetry={() => overviewQ.refetch()} />;

  const st = overview?.byStatus ?? {};
  const openCount = (st.OPEN ?? 0) + (st.ACKNOWLEDGED ?? 0) + (st.IN_PROGRESS ?? 0) + (st.REOPENED ?? 0);

  return (
    <div className="space-y-8 animate-fade-up">
      <Mk9PageHeader 
        title="Central de Qualidade" 
        subtitle="Monitoramento de integridade e inconsistências"
        icon={ShieldCheck}
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(filters.month)} onValueChange={(v) => setFilters(f => ({ ...f, month: Number(v) }))}>
              <SelectTrigger className="h-9 w-[130px] bg-command-deep border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                {MONTHS_PT.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleRun} disabled={running} className="h-9 gap-2 bg-command-purple hover:bg-command-purple/80 text-white border-none shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Executar Varredura
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Mk9MetricCard label="Integridade" value={openCount === 0 ? "100%" : "Atenção"} color={openCount === 0 ? "emerald" : "amber"} hint={`${openCount} pendências`} />
        <Mk9MetricCard label="Bloqueantes" value={overview?.bySeverity?.BLOQUEANTE ?? 0} color="rose" hint="Ação imediata" />
        <Mk9MetricCard label="Críticos" value={overview?.bySeverity?.CRITICO ?? 0} color="rose" hint="Risco operacional" />
        <Mk9MetricCard label="Analisados" value={st.RESOLVED_MANUAL ?? 0} color="blue" hint="Histórico tratado" />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Log de Inconsistências</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input 
                placeholder="Buscar por ocorrência..." 
                value={searchInput} 
                onChange={(e) => setSearchInput(e.target.value)} 
                className="pl-9 h-9 w-[280px] bg-command-deep border-white/10 text-white text-xs" 
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 overflow-hidden">
          {listQ.isLoading ? <Mk9LoadingState /> : items.length === 0 ? <Mk9EmptyState message="Nenhuma inconsistência detectada nos parâmetros atuais." /> : (
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.id} className="p-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors flex items-center justify-between group">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "mt-1 h-2 w-2 rounded-full",
                      item.severity === 'BLOQUEANTE' || item.severity === 'CRITICO' ? "bg-rose-500 shadow-[0_0_8px_#EF4444]" : "bg-amber-500 shadow-[0_0_8px_#F59E0B]"
                    )} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-white uppercase tracking-tight">{issueTypeLabel(item.issueType)}</span>
                        <Mk9Badge variant={item.severity === 'BLOQUEANTE' ? 'danger' : item.severity === 'CRITICO' ? 'danger' : 'warning'}>
                          {item.severity}
                        </Mk9Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-2xl">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        <span>{item.industryId || "Sistema"}</span>
                        <span>•</span>
                        <span>{dateTimeLabel(item.lastSeenAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 gap-2 text-slate-400 group-hover:text-command-purple opacity-0 group-hover:opacity-100 transition-all">
                    Visualizar <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Mk9Panel>
    </div>
  );
}
