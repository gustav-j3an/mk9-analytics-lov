import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  Factory
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
import { getMk9AnalyticsDashboardFn } from "@/lib/mk9-analytics/analytics.functions";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function nf(v: number) {
  return new Intl.NumberFormat("pt-BR").format(v);
}

export function Mk9AnalyticsDashboard({ initialMonth, initialYear }: { initialMonth?: number; initialYear?: number }) {
  const [month, setMonth] = useState(initialMonth || new Date().getMonth() + 1);
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const [industryId, setIndustryId] = useState("__ALL__");
  const [search, setSearch] = useState("");

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
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["mk9-analytics-data-minimal", year, month, industryId],
    queryFn: () => analyticsFn({ data: params }),
    staleTime: 60000,
  });

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  const filteredIndustries = useMemo(() => {
    if (!data?.industries) return [];
    let list = data.industries;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((i: any) => i.industryName.toLowerCase().includes(s));
    }
    return list;
  }, [data?.industries, search]);

  if (isLoading) return <Mk9LoadingState message="Carregando visão rápida..." />;
  if (error) return <Mk9ErrorState message="Erro ao carregar dashboard." onRetry={() => refetch()} />;
  if (!data) return <Mk9ErrorState message="Nenhum dado retornado." onRetry={() => refetch()} />;

  const { executive } = data;

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-7xl mx-auto">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tighter uppercase flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Dashboard
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Visão Rápida da Operação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 w-32 bg-card/40 border-border/50 text-[10px] font-bold uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS_PT.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 w-24 bg-card/40 border-border/50 text-[10px] font-bold uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger className="h-9 w-40 bg-card/40 border-border/50 text-[10px] font-bold uppercase">
                <SelectValue placeholder="Indústria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">Todas Indústrias</SelectItem>
                {(industriesQ.data || []).map(ind => (
                  <SelectItem key={ind.id} value={ind.id}>{ind.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI CARDS COMPACTOS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIMini label="Indústrias Monitoradas" value={data.perf?.monitoredIndustriesCount ?? 0} icon={Factory} />
        <KPIMini label="Visitas Previstas" value={nf(executive.contracted.current)} icon={Clock} />
        <KPIMini label="Visitas Realizadas" value={nf(executive.realized.current)} icon={CheckCircle2} color="text-emerald-500" />
        <KPIMini label="Pendentes" value={nf(executive.pending.current)} icon={AlertTriangle} color="text-amber-500" />
      </div>

      {/* LISTAGEM DE INDÚSTRIAS */}
      <div className="space-y-4 pt-4 border-t border-border/30">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Monitoramento por Indústria</h2>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Buscar indústria..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 bg-card/40 border-border/50 text-xs"
            />
          </div>
        </div>

        {/* TABLE DESKTOP */}
        <div className="hidden md:block glass-command rounded-xl overflow-hidden border border-border/50">
          <table className="w-full text-left">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Indústria</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Frequência</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Previstas</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Checklist</th>

                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Pendentes</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredIndustries.map((ind: any) => (
                <tr key={ind.industryId} className="hover:bg-muted/20 transition-colors group cursor-default">
                  <td className="px-6 py-4 font-bold text-sm text-foreground">{ind.industryName}</td>
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

        {/* CARDS MOBILE */}
        <div className="md:hidden space-y-3">
          {filteredIndustries.map((ind: any) => (
            <div key={ind.industryId} className="glass-command p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
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

                <div className="flex flex-col text-right">
                  <span className="text-muted-foreground tracking-widest mb-0.5">Checklist</span>
                  <span className="text-emerald-500">{nf(ind.realized?.current || 0)}</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-muted-foreground tracking-widest mb-0.5">Pendentes</span>
                  <span className="text-amber-500">{nf(ind.pendingCount || 0)}</span>
                </div>
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${Math.min(100, ind.coverage.current)}%` }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>
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
