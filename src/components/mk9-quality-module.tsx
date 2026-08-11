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
  Eye,
} from "lucide-react";

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
  Mk9EmptyState,
} from "./mk9/design-system";
import { QualityIssueDetailSheet } from "./mk9/quality-issue-detail";

const PAGE_SIZE = 25;
const ALL = "__ALL__";

export function Mk9QualityModule({
  month,
  year,
  onNavigate,
}: {
  month: number;
  year: number;
  onNavigate?: (t: ResolvedNavigation) => void;
}) {
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
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  useEffect(() => {
    setFilters((f) => ({ ...f, month, year, page: 1 }));
  }, [month, year]);

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
          status:
            filters.status === "__OPEN__"
              ? ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "REOPENED"]
              : [filters.status as any],
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
  const items = useMemo(
    () => sortIssues((listQ.data?.items ?? []) as Mk9QualityIssueView[]),
    [listQ.data],
  );

  if (overviewQ.isLoading) return <Mk9LoadingState message="Analisando integridade dos dados..." />;
  if (overviewQ.isError)
    return (
      <Mk9ErrorState
        message="Falha ao carregar central de qualidade."
        onRetry={() => overviewQ.refetch()}
      />
    );

  const st = overview?.byStatus ?? {};
  const openCount =
    (st.OPEN ?? 0) + (st.ACKNOWLEDGED ?? 0) + (st.IN_PROGRESS ?? 0) + (st.REOPENED ?? 0);

  return (
    <div className="space-y-8 animate-fade-up">
      <Mk9PageHeader
        title="Qualidade dos Dados"
        subtitle="Integridade analítica e monitoramento de inconsistências"
        icon={ShieldCheck}
        actions={
          <div className="flex items-center gap-2 glass-command p-1.5 rounded-xl border border-border/50">
            <Select
              value={String(filters.month)}
              onValueChange={(v) => setFilters((f) => ({ ...f, month: Number(v) }))}
            >
              <SelectTrigger className="h-8 w-[120px] bg-input/50 border-border/50 text-[10px] font-bold text-foreground uppercase tracking-wider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                {MONTHS_PT.map((m, i) => (
                  <SelectItem
                    key={m}
                    value={String(i + 1)}
                    className="text-[10px] font-bold uppercase"
                  >
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleRun}
              disabled={running}
              className="h-8 gap-2 bg-command-purple hover:bg-command-purple/80 text-foreground border-none shadow-[0_0_15px_rgba(168,85,247,0.3)] uppercase text-[10px] font-black tracking-widest px-4"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Varredura
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Mk9MetricCard
          label="Integridade"
          value={openCount === 0 ? "100%" : "Atenção"}
          color={openCount === 0 ? "emerald" : "amber"}
          hint={`${openCount} pendências`}
        />
        <Mk9MetricCard
          label="Bloqueantes"
          value={overview?.bySeverity?.BLOQUEANTE ?? 0}
          color="rose"
          hint="Ação imediata"
        />
        <Mk9MetricCard
          label="Inconsistências"
          value={overview?.bySeverity?.CRITICO ?? 0}
          color="rose"
          hint="Risco operacional"
        />
        <Mk9MetricCard
          label="Alertas"
          value={overview?.bySeverity?.ALERTA ?? 0}
          color="amber"
          hint="Observação"
        />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
            Log de Inconsistências
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por ocorrência..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-9 w-[280px] bg-popover border-border text-popover-foreground text-xs"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 overflow-hidden">
          {listQ.isLoading ? (
            <Mk9LoadingState />
          ) : items.length === 0 ? (
            <Mk9EmptyState message="Nenhuma inconsistência detectada nos parâmetros atuais." />
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "mt-1 h-2 w-2 rounded-full",
                        item.severity === "BLOQUEANTE" || item.severity === "CRITICO"
                          ? "bg-rose-500 shadow-[0_0_8px_#EF4444]"
                          : "bg-amber-500 shadow-[0_0_8px_#F59E0B]",
                      )}
                    />
                    <div>
                      <div className="flex flex-col gap-1.5 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black text-foreground uppercase tracking-tighter">
                            {String(item.evidence?.industryName ?? item.industryId ?? "SISTEMA")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-tighter">
                            {String(item.evidence?.storeName ?? item.storeId ?? "-")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                            {item.evidence?.uf ? `${item.evidence.uf} • ` : ""}{dateTimeLabel(item.lastSeenAt)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-command-purple uppercase tracking-tight">
                          {issueTypeLabel(item.issueType)}
                        </span>
                        <Mk9Badge
                          variant={
                            item.severity === "BLOQUEANTE" || item.severity === "CRITICO"
                              ? "danger"
                              : "warning"
                          }
                          className="text-[8px] px-1.5 h-4"
                        >
                          {item.severity}
                        </Mk9Badge>
                      </div>
                      
                      <p className="mt-2 text-[10px] text-muted-foreground font-medium leading-relaxed max-w-2xl border-l-2 border-border/50 pl-3">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIssueId(item.id)}
                    className="h-8 gap-2 text-muted-foreground group-hover:text-command-purple opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Visualizar <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Mk9Panel>

      <QualityIssueDetailSheet 
        issueId={selectedIssueId} 
        onClose={() => setSelectedIssueId(null)}
        onNavigateToEntity={(type, id) => {
          if (type === 'routes') {
            onNavigate?.({ 
              module: 'routes',
              industryId: null,
              storeId: null,
              month,
              year
            });
          }
          setSelectedIssueId(null);
        }}
      />
    </div>
  );
}
