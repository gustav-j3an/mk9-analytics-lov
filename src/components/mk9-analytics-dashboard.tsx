import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  Factory,
  ChevronRight,
  ArrowUpDown,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercentage } from "@/lib/mk9/normalization";
import { Mk9LoadingState, Mk9ErrorState } from "./mk9/design-system";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getMk9AnalyticsDashboardFn } from "@/lib/mk9-analytics/analytics.functions";
import { getIndustryDrilldownFn } from "@/lib/mk9-analytics/drilldown.functions";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type SortMode = "REALIZED" | "PREDICTED" | "COVERAGE_ASC" | "COVERAGE_DESC" | "NAME";

function nf(v: number) {
  return new Intl.NumberFormat("pt-BR").format(v);
}

export function Mk9AnalyticsDashboard({ initialMonth, initialYear }: { initialMonth?: number; initialYear?: number }) {
  const [month, setMonth] = useState(initialMonth || new Date().getMonth() + 1);
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const [industryId, setIndustryId] = useState("__ALL__");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("REALIZED");
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  const analyticsFn = useServerFn(getMk9AnalyticsDashboardFn);
  const industriesFn = useServerFn(mk9ListIndustries);
  const drilldownFn = useServerFn(getIndustryDrilldownFn);

  useEffect(() => { if (initialMonth) setMonth(initialMonth); }, [initialMonth]);
  useEffect(() => { if (initialYear) setYear(initialYear); }, [initialYear]);

  const industriesQ = useQuery({
    queryKey: ["mk9-industries-list"],
    queryFn: () => industriesFn(),
    staleTime: 300000,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["mk9-analytics-data-minimal", year, month, industryId],
    queryFn: () => analyticsFn({ data: { year, month, industryId: industryId === "__ALL__" ? null : industryId } }),
    staleTime: 60000,
  });

  const { data: drilldown, isLoading: loadingDrilldown } = useQuery({
    queryKey: ["mk9-industry-drilldown", year, month, selectedIndustry],
    queryFn: () => drilldownFn({ data: { year, month, industryId: selectedIndustry! } }),
    enabled: !!selectedIndustry,
  });

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  const processedIndustries = useMemo(() => {
    if (!data?.industries) return [];
    let list = [...data.industries];

    if (search) {
      const s = search.toLowerCase();
      list = list.filter((i: any) => i.industryName.toLowerCase().includes(s));
    }

    const active = list.filter(i => i.coverage.current > 0 || i.coverage.previous > 0 || i.pendingCount > 0);
    const zero = list.filter(i => i.coverage.current === 0 && i.coverage.previous === 0 && i.pendingCount === 0);

    const sortFn = (a: any, b: any) => {
      switch (sortMode) {
        case "REALIZED": return (b.realized?.current || 0) - (a.realized?.current || 0);
        case "PREDICTED": return (b.contracted?.current || 0) - (a.contracted?.current || 0);
        case "COVERAGE_DESC": return (b.coverage.current || 0) - (a.coverage.current || 0);
        case "COVERAGE_ASC": return (a.coverage.current || 0) - (b.coverage.current || 0);
        case "NAME": return a.industryName.localeCompare(b.industryName);
        default: return 0;
      }
    };

    return [...active.sort(sortFn), ...zero.sort(sortFn)];
  }, [data?.industries, search, sortMode]);

  if (isLoading) return <Mk9LoadingState message="Carregando visão rápida..." />;
  if (error) return <Mk9ErrorState message="Erro ao carregar dashboard." onRetry={() => refetch()} />;
  if (!data) return <Mk9ErrorState message="Nenhum dado retornado." onRetry={() => refetch()} />;

  const { executive } = data;

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-7xl mx-auto px-4 md:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tighter uppercase flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Dashboard
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            MK9 Command Center
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-9 w-32 bg-card/40 border-border/50 text-[10px] font-bold uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_PT.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-24 bg-card/40 border-border/50 text-[10px] font-bold uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={industryId} onValueChange={setIndustryId}>
            <SelectTrigger className="h-9 w-40 bg-card/40 border-border/50 text-[10px] font-bold uppercase">
              <SelectValue placeholder="Indústria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Todas Indústrias</SelectItem>
              {(industriesQ.data || []).map(ind => <SelectItem key={ind.id} value={ind.id}>{ind.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIMini label="Indústrias Monitoradas" value={data.perf?.monitoredIndustriesCount ?? 0} icon={Factory} />
        <KPIMini label="Visitas Previstas" value={nf(executive.contracted.current)} icon={Clock} />
        <KPIMini label="Visitas Realizadas" value={nf(executive.realized.current)} icon={CheckCircle2} color="text-emerald-500" />
        <KPIMini label="Pendentes" value={nf(executive.pending.current)} icon={AlertTriangle} color="text-amber-500" />
      </div>

      <div className="space-y-4 pt-4 border-t border-border/30">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Monitoramento por Indústria</h2>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Buscar indústria..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 bg-card/40 border-border/50 text-xs"
              />
            </div>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-9 w-40 bg-card/40 border-border/50 text-[10px] font-bold uppercase">
                <ArrowUpDown className="w-3 h-3 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REALIZED">Mais realizadas</SelectItem>
                <SelectItem value="PREDICTED">Mais previstas</SelectItem>
                <SelectItem value="COVERAGE_DESC">Maior cobertura</SelectItem>
                <SelectItem value="COVERAGE_ASC">Menor cobertura</SelectItem>
                <SelectItem value="NAME">Nome</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="hidden md:block glass-command rounded-xl overflow-hidden border border-border/50">
          <table className="w-full text-left">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Indústria</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Frequência</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Previstas</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Realizadas</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Pendentes</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {processedIndustries.map((ind: any) => (
                <tr 
                  key={ind.industryId} 
                  onClick={() => setSelectedIndustry(ind.industryId)}
                  className="hover:bg-muted/20 transition-all group cursor-pointer active:bg-muted/30"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{ind.industryName}</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-black text-muted-foreground uppercase">{ind.frequency || "-"}</span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-xs">{nf(ind.contracted?.current || 0)}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs text-emerald-500/80">{nf(ind.realized?.current || 0)}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs text-amber-500/80">{nf(ind.pendingCount || 0)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden hidden lg:block">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${Math.min(100, ind.coverage.current)}%` }} 
                        />
                      </div>
                      <span className="font-black text-xs min-w-[50px]">{formatPercentage(ind.coverage.current)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {processedIndustries.map((ind: any) => (
            <div 
              key={ind.industryId} 
              onClick={() => setSelectedIndustry(ind.industryId)}
              className="glass-command p-4 rounded-xl border border-border/50 bg-card/50 space-y-3 active:scale-[0.98] transition-transform"
            >
              <div className="flex justify-between items-start">
                <span className="font-black text-sm text-foreground uppercase tracking-tighter">{ind.industryName}</span>
                <span className="text-[10px] font-black text-primary">{formatPercentage(ind.coverage.current)}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-[10px] font-bold uppercase">
                <div className="flex flex-col text-left">
                  <span className="text-muted-foreground tracking-widest mb-0.5">Frequência</span>
                  <span>{ind.frequency || "-"}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-muted-foreground tracking-widest mb-0.5">Previstas</span>
                  <span>{nf(ind.contracted?.current || 0)}</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-muted-foreground tracking-widest mb-0.5">Realizadas</span>
                  <span className="text-emerald-500">{nf(ind.realized?.current || 0)}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-muted-foreground tracking-widest mb-0.5">Pendentes</span>
                  <span className="text-amber-500">{nf(ind.pendingCount || 0)}</span>
                </div>
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, ind.coverage.current)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={!!selectedIndustry} onOpenChange={(open) => !open && setSelectedIndustry(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-black italic tracking-tighter uppercase">
              {drilldown?.industry?.industryName || "Carregando..."}
            </SheetTitle>
            <SheetDescription className="text-[10px] font-bold uppercase tracking-widest">
              Detalhes de Execução por Loja • {MONTHS_PT[month-1]} {year}
            </SheetDescription>
          </SheetHeader>

          {loadingDrilldown ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Activity className="w-8 h-8 text-primary animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando lojas...</span>
            </div>
          ) : drilldown && (
            <div className="space-y-8 pb-10">
              <div className="grid grid-cols-2 gap-4">
                <DetailKPI label="Visitas Previstas" value={nf(drilldown.industry.contratadas)} />
                <DetailKPI label="Realizadas" value={nf(drilldown.industry.realizadas)} color="text-emerald-500" />
                <DetailKPI label="Pendentes" value={nf(drilldown.industry.pendentes)} color="text-amber-500" />
                <DetailKPI label="Cobertura" value={formatPercentage(drilldown.industry.coberturaPct)} />
              </div>


              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Lojas Atendidas</h3>
                <div className="space-y-3">
                  {drilldown.stores.map((s: any) => (
                    <div key={s.storeId} className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-sm text-foreground">{s.storeName}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{s.uf || "Sem UF"}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black uppercase border-primary/20 bg-primary/5">
                          {formatPercentage(s.coverage)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-[9px] font-bold uppercase text-muted-foreground">
                        <div className="space-y-0.5">
                          <span className="tracking-tighter">Frequência</span>
                          <p className="text-foreground">{s.frequency || "-"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="tracking-tighter">Previstas</span>
                          <p className="text-foreground">{nf(s.contracted)}</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="tracking-tighter">Realizadas</span>
                          <p className="text-emerald-500">{nf(s.realized)}</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="tracking-tighter">Pendentes</span>
                          <p className="text-amber-500">{nf(s.pending)}</p>
                        </div>
                      </div>
                      {s.lastVisit && (
                        <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest pt-1 border-t border-border/10">
                          Última Visita: {new Date(s.lastVisit).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KPIMini({ label, value, icon: Icon, color = "text-foreground" }: any) {
  return (
    <div className="glass-command p-4 rounded-xl border border-border/50 bg-card/50 flex items-center gap-4">
      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-0.5">{label}</p>
        <h3 className={cn("text-xl font-black italic leading-none tracking-tighter", color)}>{value}</h3>
      </div>
    </div>
  );
}

function DetailKPI({ label, value, color = "text-foreground" }: any) {
  return (
    <div className="p-4 rounded-xl border border-border/50 bg-muted/20">
      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={cn("text-xl font-black italic tracking-tighter", color)}>{value}</p>
    </div>
  );
}
