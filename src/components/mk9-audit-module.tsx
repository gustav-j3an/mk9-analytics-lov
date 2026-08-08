import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardList,
  Download,
  Search as SearchIcon,
  FileCheck,
  AlertTriangle,
  Route as RouteIcon,
  Filter,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

import { mk9ListIndustries, mk9ListPromoters } from "@/lib/mk9-data.functions";
import { auditByStoreFn, auditByPromoterFn, auditByIndustryFn } from "@/lib/mk9-audit.functions";
import { Mk9ReconciliationModule } from "@/components/mk9-reconciliation-module";
import {
  Mk9PageHeader,
  Mk9MetricCard,
  Mk9Panel,
  Mk9Badge,
  Mk9LoadingState,
  Mk9ErrorState,
  Mk9EmptyState,
} from "./mk9/design-system";

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
const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

type TabKey = "industry" | "store" | "promoter" | "review";

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return d && m && y ? `${d}/${m}/${y}` : v;
}

export interface Mk9AuditInitialFilters {
  month?: number;
  year?: number;
  industryId?: string | null;
  uf?: string | null;
  promoterId?: string | null;
}

export function Mk9AuditModule({
  initialFilters,
}: {
  initialFilters?: Mk9AuditInitialFilters;
} = {}) {
  const now = new Date();
  const [year, setYear] = useState<number>(initialFilters?.year ?? now.getFullYear());
  const [month, setMonth] = useState<number>(initialFilters?.month ?? now.getMonth() + 1);
  const [industryId, setIndustryId] = useState<string>(initialFilters?.industryId ?? "__ALL__");
  const [promoterId, setPromoterId] = useState<string>(initialFilters?.promoterId ?? "__ALL__");
  const [uf, setUf] = useState<string>(initialFilters?.uf ?? "__ALL__");
  const [tab, setTab] = useState<TabKey>("industry");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (initialFilters?.month) setMonth(initialFilters.month);
  }, [initialFilters?.month]);

  useEffect(() => {
    if (initialFilters?.year) setYear(initialFilters.year);
  }, [initialFilters?.year]);

  const industriesFn = useServerFn(mk9ListIndustries);
  const promotersFn = useServerFn(mk9ListPromoters);
  const byStoreFn = useServerFn(auditByStoreFn);
  const byPromoter = useServerFn(auditByPromoterFn);
  const byIndustry = useServerFn(auditByIndustryFn);

  const scope = useMemo(
    () => ({
      year,
      month,
      industryId: industryId === "__ALL__" ? null : industryId,
      uf: uf === "__ALL__" ? null : uf,
      promoterId: promoterId === "__ALL__" ? null : promoterId,
    }),
    [year, month, industryId, uf, promoterId],
  );

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn() });
  const promotersQ = useQuery({ queryKey: ["mk9-promoters"], queryFn: () => promotersFn() });

  const industryQ = useQuery({
    queryKey: ["mk9-audit", "industry", scope],
    queryFn: () => byIndustry({ data: scope }),
    enabled: tab === "industry",
  });
  const storeQ = useQuery({
    queryKey: ["mk9-audit", "store", scope],
    queryFn: () => byStoreFn({ data: scope }),
    enabled: tab === "store",
  });
  const promoterQ = useQuery({
    queryKey: ["mk9-audit", "promoter", scope],
    queryFn: () => byPromoter({ data: scope }),
    enabled: tab === "promoter",
  });

  const globalTotals = useMemo(() => {
    const rows = (industryQ.data ?? storeQ.data?.totals ?? []) as any[];
    let contratadas = 0,
      realizadas = 0,
      storesCount = 0;
    for (const r of rows) {
      contratadas += r.contratadas ?? 0;
      realizadas += r.realizadas ?? 0;
      storesCount += r.storesCount ?? 0;
    }
    const pendentes = Math.max(0, contratadas - realizadas);
    const coberturaPct =
      contratadas > 0 ? Math.min(100, Math.round((realizadas / contratadas) * 100)) : 0;
    return { contratadas, realizadas, pendentes, coberturaPct, storesCount };
  }, [industryQ.data, storeQ.data]);

  return (
    <div className="space-y-8 animate-fade-up">
      <Mk9PageHeader
        title="Central de Conciliação"
        subtitle="Controle e auditoria de visitas realizadas"
        icon={ClipboardList}
      />

      <Mk9Panel>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
            Parâmetros de Auditoria
          </h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-slate-400 hover:text-white hover:bg-white/5"
              onClick={() => {
                industryQ.refetch();
                storeQ.refetch();
                promoterQ.refetch();
              }}
            >
              <RefreshCw className="h-3 w-3 mr-2" /> Sincronizar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Mês
            </label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                {MONTHS_PT.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Ano
            </label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Indústria
            </label>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                <SelectItem value="__ALL__">Todas as indústrias</SelectItem>
                {(industriesQ.data ?? []).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Promotor
            </label>
            <Select value={promoterId} onValueChange={setPromoterId}>
              <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                <SelectItem value="__ALL__">Todos os promotores</SelectItem>
                {(promotersQ.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              UF
            </label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                <SelectItem value="__ALL__">Todas as UFs</SelectItem>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Mk9Panel>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Mk9MetricCard
          label="Contratadas"
          value={globalTotals.contratadas}
          icon={RouteIcon}
          color="blue"
        />
        <Mk9MetricCard
          label="Realizadas"
          value={globalTotals.realizadas}
          icon={FileCheck}
          color="emerald"
        />
        <Mk9MetricCard
          label="Pendentes"
          value={globalTotals.pendentes}
          icon={AlertTriangle}
          color="amber"
        />
        <Mk9MetricCard label="Cobertura" value={`${globalTotals.coberturaPct}%`} color="purple" />
        <Mk9MetricCard label="Lojas Ativas" value={globalTotals.storesCount} color="blue" />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-auto">
            <TabsList className="bg-command-deep border border-white/5 p-1">
              <TabsTrigger
                value="industry"
                className="data-[state=active]:bg-command-purple data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest"
              >
                Por Indústria
              </TabsTrigger>
              <TabsTrigger
                value="store"
                className="data-[state=active]:bg-command-purple data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest"
              >
                Por Loja
              </TabsTrigger>
              <TabsTrigger
                value="promoter"
                className="data-[state=active]:bg-command-purple data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest"
              >
                Por Promotor
              </TabsTrigger>
              <TabsTrigger
                value="review"
                className="data-[state=active]:bg-command-purple data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest"
              >
                Revisão Manual
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab !== "review" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Filtrar resultados..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 w-[240px] bg-command-deep border-white/10 text-white text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-white/10 bg-white/5 text-slate-400 hover:text-white"
              >
                <Download className="h-3.5 w-3.5 mr-2" /> Exportar
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/5 overflow-hidden">
          {tab === "industry" && <IndustryTable q={industryQ} />}
          {tab === "store" && <StoreTable q={storeQ} search={search} />}
          {tab === "promoter" && <PromoterTable q={promoterQ} search={search} />}
          {tab === "review" && (
            <div className="p-4 space-y-4">
              <Mk9ReconciliationModule />
            </div>
          )}
        </div>
      </Mk9Panel>
    </div>
  );
}

function IndustryTable({ q }: { q: any }) {
  if (q.isLoading) return <Mk9LoadingState />;
  const rows = (q.data ?? []) as any[];
  if (rows.length === 0) return <Mk9EmptyState />;

  return (
    <Table>
      <TableHeader className="bg-white/5">
        <TableRow className="border-white/5 hover:bg-transparent">
          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Indústria
          </TableHead>
          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Período
          </TableHead>
          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
            Contratadas
          </TableHead>
          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
            Realizadas
          </TableHead>
          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
            Cobertura
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.industryId}
            className="border-white/5 hover:bg-white/[0.02] transition-colors"
          >
            <TableCell className="font-bold text-white">{r.industryName}</TableCell>
            <TableCell className="text-[10px] text-slate-500 font-medium">
              {fmtDate(r.window.startDate)} — {fmtDate(r.window.endDate)}
            </TableCell>
            <TableCell className="text-right font-medium text-slate-300">{r.contratadas}</TableCell>
            <TableCell className="text-right font-medium text-emerald-400">
              {r.realizadas}
            </TableCell>
            <TableCell className="text-right">
              <Mk9Badge
                variant={
                  r.coberturaPct >= 100 ? "success" : r.coberturaPct >= 80 ? "info" : "warning"
                }
              >
                {r.coberturaPct}%
              </Mk9Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StoreTable({ q, search }: { q: any; search: string }) {
  if (q.isLoading) return <Mk9LoadingState />;
  let rows = (q.data?.stores ?? []) as any[];
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) => r.storeName.toLowerCase().includes(s) || r.industryName.toLowerCase().includes(s),
    );
  }
  if (rows.length === 0) return <Mk9EmptyState />;

  return (
    <Table>
      <TableHeader className="bg-white/5">
        <TableRow className="border-white/5 hover:bg-transparent">
          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Loja / Rede
          </TableHead>
          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Indústria
          </TableHead>
          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
            Contratadas
          </TableHead>
          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
            Realizadas
          </TableHead>
          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Status
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={`${r.industryId}-${r.storeId}`}
            className="border-white/5 hover:bg-white/[0.02] transition-colors"
          >
            <TableCell>
              <div className="font-bold text-white uppercase tracking-tight">{r.storeName}</div>
              <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                {r.chain ?? "—"}
              </div>
            </TableCell>
            <TableCell className="text-[10px] font-bold text-slate-400">{r.industryName}</TableCell>
            <TableCell className="text-right font-medium text-slate-300">{r.contratadas}</TableCell>
            <TableCell className="text-right font-medium text-emerald-400">
              {r.realizadas}
            </TableCell>
            <TableCell>
              <Mk9Badge
                variant={
                  r.status === "COMPLETO"
                    ? "success"
                    : r.status === "PARCIAL"
                      ? "warning"
                      : "danger"
                }
              >
                {r.status}
              </Mk9Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PromoterTable({ q, search }: { q: any; search: string }) {
  if (q.isLoading) return <Mk9LoadingState />;
  let rows = (q.data ?? []) as any[];
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter((r) => r.promoterName.toLowerCase().includes(s));
  }
  if (rows.length === 0) return <Mk9EmptyState />;

  return (
    <Table>
      <TableHeader className="bg-white/5">
        <TableRow className="border-white/5 hover:bg-transparent">
          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Promotor
          </TableHead>
          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
            Lojas
          </TableHead>
          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
            Contratadas
          </TableHead>
          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
            Realizadas
          </TableHead>
          <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
            Cobertura
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.promoterId ?? "none"}
            className="border-white/5 hover:bg-white/[0.02] transition-colors"
          >
            <TableCell className="font-bold text-white">{r.promoterName}</TableCell>
            <TableCell className="text-right font-medium text-slate-400">{r.storesCount}</TableCell>
            <TableCell className="text-right font-medium text-slate-300">{r.contratadas}</TableCell>
            <TableCell className="text-right font-medium text-emerald-400">
              {r.realizadas}
            </TableCell>
            <TableCell className="text-right">
              <Mk9Badge
                variant={
                  r.coberturaPct >= 100 ? "success" : r.coberturaPct >= 80 ? "info" : "warning"
                }
              >
                {r.coberturaPct}%
              </Mk9Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
