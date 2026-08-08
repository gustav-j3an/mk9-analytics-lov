import { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Ban,
  ShieldQuestion,
  Download,
  ChevronDown,
  ChevronRight,
  Search as SearchIcon,
  Store as StoreIcon,
  Link2,
  Undo2,
  Eye,
  Filter,
  FileSpreadsheet,
  SearchIcon as Search,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { mk9ListIndustries, mk9ListPromoters } from "@/lib/mk9-data.functions";
import {
  reconcileRun,
  reconcileSummary,
  reconcileIgnore,
  reconcileUndoReview,
  reconcileListPaged,
  reconcileDetail,
  reconcileFindCandidates,
  reconcileManualMatch,
  reconcileAcceptDivergence,
  reconcileSearchStores,
  reconcileLinkStore,
  reconcileListImports,
} from "@/lib/mk9-reconciliation.functions";
import { STATUS_LABELS_PT, type ReconciliationStatus } from "@/lib/mk9-reconciliation/types";
import { Mk9PageHeader, Mk9Panel, Mk9MetricCard, Mk9Badge } from "./mk9/design-system";

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
const WEEKDAY_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
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

const STATUS_TONE: Record<ReconciliationStatus, string> = {
  MATCHED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  DATE_DIVERGENCE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  UNPLANNED_VISIT: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  NOT_COMPLETED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  STORE_NOT_FOUND: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  AMBIGUOUS: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  DUPLICATE_ACTUAL: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  MANUALLY_MATCHED: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  IGNORED: "bg-muted text-muted-foreground border-border",
};

const STATUS_ICON: Record<ReconciliationStatus, React.ReactNode> = {
  MATCHED: <CheckCircle2 className="h-3.5 w-3.5" />,
  DATE_DIVERGENCE: <AlertTriangle className="h-3.5 w-3.5" />,
  UNPLANNED_VISIT: <HelpCircle className="h-3.5 w-3.5" />,
  NOT_COMPLETED: <XCircle className="h-3.5 w-3.5" />,
  STORE_NOT_FOUND: <StoreIcon className="h-3.5 w-3.5" />,
  AMBIGUOUS: <ShieldQuestion className="h-3.5 w-3.5" />,
  DUPLICATE_ACTUAL: <AlertTriangle className="h-3.5 w-3.5" />,
  MANUALLY_MATCHED: <CheckCircle2 className="h-3.5 w-3.5" />,
  IGNORED: <Ban className="h-3.5 w-3.5" />,
};

type TabKey =
  | "all"
  | "matched"
  | "pending"
  | "unplanned"
  | "manual"
  | "not_completed"
  | "store_not_found";

const TAB_STATUSES: Record<TabKey, ReconciliationStatus[] | null> = {
  all: null,
  matched: ["MATCHED"],
  pending: ["DATE_DIVERGENCE", "AMBIGUOUS", "DUPLICATE_ACTUAL", "STORE_NOT_FOUND"],
  unplanned: ["UNPLANNED_VISIT"],
  manual: ["MANUALLY_MATCHED"],
  not_completed: ["NOT_COMPLETED"],
  store_not_found: ["STORE_NOT_FOUND"],
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return d && m && y ? `${d}/${m}/${y}` : v;
}

function useDebouncedValue<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Mk9ReconciliationModule({ initialMonth, initialYear }: { initialMonth?: number; initialYear?: number } = {}) {
  const [year, setYear] = useState<number>(initialYear || new Date().getFullYear());
  const [month, setMonth] = useState<number>(initialMonth || new Date().getMonth() + 1);
  const [industryId, setIndustryId] = useState<string>("__ALL__");
  const [promoterId, setPromoterId] = useState<string>("__ALL__");
  const [uf, setUf] = useState<string>("__ALL__");
  const [importId, setImportId] = useState<string>("__ALL__");
  const [tab, setTab] = useState<TabKey>("all");
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [expanded, setExpanded] = useState<string | null>(null);

  // modals
  const [reviewTarget, setReviewTarget] = useState<any | null>(null);
  const [storeTarget, setStoreTarget] = useState<any | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<any | null>(null);

  const qc = useQueryClient();
  const industriesFn = useServerFn(mk9ListIndustries);
  const promotersFn = useServerFn(mk9ListPromoters);
  const summaryFn = useServerFn(reconcileSummary);
  const listPagedFn = useServerFn(reconcileListPaged);
  const runFn = useServerFn(reconcileRun);
  const ignoreFn = useServerFn(reconcileIgnore);
  const undoFn = useServerFn(reconcileUndoReview);
  const importsFn = useServerFn(reconcileListImports);

  const scope = useMemo(
    () => ({
      operationYear: year,
      operationMonth: month,
      industryId: industryId === "__ALL__" ? null : industryId,
    }),
    [year, month, industryId],
  );

  const filters = useMemo(
    () => ({
      ...scope,
      sourceImportId: importId === "__ALL__" ? null : importId,
      promoterId: promoterId === "__ALL__" ? null : promoterId,
      uf: uf === "__ALL__" ? null : uf,
      statuses: TAB_STATUSES[tab],
      search: search || null,
      page,
      pageSize,
    }),
    [scope, importId, promoterId, uf, tab, search, page, pageSize],
  );

  useEffect(() => {
    if (initialMonth) setMonth(initialMonth);
  }, [initialMonth]);

  useEffect(() => {
    if (initialYear) setYear(initialYear);
  }, [initialYear]);

  useEffect(() => {
    setPage(1);
  }, [tab, industryId, promoterId, uf, importId, search, month, year]);

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn() });
  const promotersQ = useQuery({ queryKey: ["mk9-promoters"], queryFn: () => promotersFn() });
  const importsQ = useQuery({
    queryKey: ["mk9-reco", "imports", scope],
    queryFn: () => importsFn({ data: scope }),
  });
  const summaryQ = useQuery({
    queryKey: ["mk9-reco", "summary", scope],
    queryFn: () => summaryFn({ data: scope }),
  });
  const listQ = useQuery({
    queryKey: ["mk9-reco", "list-paged", filters],
    queryFn: () => listPagedFn({ data: filters }),
  });

  const runMut = useMutation({
    mutationFn: () => runFn({ data: scope }),
    onSuccess: () => {
      toast.success("Conciliação executada");
      qc.invalidateQueries({ queryKey: ["mk9-reco"] });
    },
    onError: (e: any) => toast.error(`Falha: ${e?.message ?? e}`),
  });
  const ignoreMut = useMutation({
    mutationFn: (payload: { id: string; notes?: string }) =>
      ignoreFn({ data: { reconciliationId: payload.id, notes: payload.notes ?? null } }),
    onSuccess: () => {
      toast.success("Marcado como ignorado");
      qc.invalidateQueries({ queryKey: ["mk9-reco"] });
      setIgnoreTarget(null);
    },
    onError: (e: any) => toast.error(`Falha: ${e?.message ?? e}`),
  });
  const undoMut = useMutation({
    mutationFn: (id: string) => undoFn({ data: { reconciliationId: id } }),
    onSuccess: () => {
      toast.success("Revisão desfeita");
      qc.invalidateQueries({ queryKey: ["mk9-reco"] });
    },
    onError: (e: any) => toast.error(`Falha: ${e?.message ?? e}`),
  });

  const s = summaryQ.data;
  const rows = listQ.data?.rows ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function exportCsv() {
    const cols = [
      "status",
      "industria",
      "promotor",
      "loja",
      "uf",
      "data_planejada",
      "data_realizada",
      "diff_dias",
      "score",
      "tipo",
      "revisao_manual",
      "observacao",
      "arquivo",
    ];
    const header = cols.join(";");
    const importById = new Map((importsQ.data ?? []).map((i: any) => [i.id, i.filename]));
    const body = rows
      .map((r: any) =>
        [
          STATUS_LABELS_PT[r.status as ReconciliationStatus] ?? r.status,
          r.industry?.name ?? "",
          r.promoter?.name ?? "",
          r.store?.name ?? r.raw_store_name ?? "",
          r.store?.uf ?? r.raw_store_uf ?? "",
          fmtDate(r.planned_date),
          fmtDate(r.actual_date),
          r.date_diff_days ?? "",
          r.match_score ?? "",
          r.match_type ?? "",
          r.reviewed_manually ? "sim" : "não",
          (r.notes ?? "").replace(/[\r\n;]+/g, " "),
          importById.get(r.source_import_id) ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      )
      .join("\n");
    const csv = "\ufeff" + header + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conciliacao_${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Mk9PageHeader
        title="Central de Conciliação"
        subtitle="Sincronização entre roteiro planejado e checklist realizado"
        icon={ShieldCheck}
      />

      <Mk9Panel>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Ano
            </label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 min-w-[100px] bg-black/40 border-white/5 text-xs text-white px-3 gap-2 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Mês
            </label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 min-w-[130px] bg-black/40 border-white/5 text-xs text-white uppercase px-3 gap-2 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                {MONTHS_PT.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Indústria
            </label>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger className="h-9 bg-black/40 border-white/5 text-xs text-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="__ALL__">Todas as indústrias</SelectItem>
                {(industriesQ.data ?? []).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Promotor
            </label>
            <Select value={promoterId} onValueChange={setPromoterId}>
              <SelectTrigger className="h-9 bg-black/40 border-white/5 text-xs text-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
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
              <SelectTrigger className="h-9 bg-black/40 border-white/5 text-xs text-white">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="__ALL__">Todas</SelectItem>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Checklist
            </label>
            <Select value={importId} onValueChange={setImportId}>
              <SelectTrigger className="h-9 bg-black/40 border-white/5 text-xs text-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="__ALL__">Todos os checklists</SelectItem>
                {(importsQ.data ?? []).map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.filename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1 sm:col-span-2 md:col-span-3 flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => runMut.mutate()}
              disabled={runMut.isPending}
              className="h-9 bg-command-purple hover:bg-command-purple/80 text-white border-none shadow-[0_0_15px_rgba(168,85,247,0.3)] flex-1 text-[10px] font-black uppercase tracking-widest"
            >
              {runMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Conciliar
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="h-9 border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest"
            >
              <Download className="h-4 w-4 mr-2" /> Exportar
            </Button>
          </div>
        </div>

        {s && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t border-white/5">
            <Mk9MetricCard label="Contratadas" value={s.metrics.contratadas} color="purple" />
            <Mk9MetricCard label="Executadas" value={s.metrics.executadas} color="blue" />
            <Mk9MetricCard label="Válidas" value={s.metrics.validas} color="emerald" />
            <Mk9MetricCard label="Pendências" value={s.metrics.pendencias} color="rose" />
            <Mk9MetricCard label="Extras" value={s.metrics.extras} color="amber" />
            <Mk9MetricCard
              label="Cobertura"
              value={`${s.metrics.coberturaPct}%`}
              color={s.metrics.coberturaPct >= 90 ? "emerald" : "amber"}
            />
            <Mk9MetricCard label="Conciliadas" value={s.matched} color="emerald" />
            <Mk9MetricCard label="Data Divergente" value={s.dateDivergence} color="amber" />
            <Mk9MetricCard label="Fora Roteiro" value={s.unplanned} color="sky" />
            <Mk9MetricCard label="Não Realizadas" value={s.notCompleted} color="rose" />
            <Mk9MetricCard label="Ambíguas" value={s.ambiguous} color="orange" />
            <Mk9MetricCard label="Lojas ?" value={s.storeNotFound} color="purple" />
          </div>
        )}
      </Mk9Panel>

      <Mk9Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
            Registros de Conciliação ({total})
          </h3>
          <div className="relative w-[280px] max-w-full">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Buscar loja, promotor, indústria…"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="pl-9 h-9 bg-command-deep border-white/10 text-white text-xs"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-6">
          <TabsList className="flex flex-wrap h-auto bg-black/20 border border-white/5 p-1">
            <TabsTrigger
              value="all"
              className="text-[10px] uppercase font-bold px-4 py-2 data-[state=active]:bg-command-purple data-[state=active]:text-white"
            >
              Geral
            </TabsTrigger>
            <TabsTrigger
              value="matched"
              className="text-[10px] uppercase font-bold px-4 py-2 data-[state=active]:bg-command-purple data-[state=active]:text-white"
            >
              Conciliadas
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="text-[10px] uppercase font-bold px-4 py-2 data-[state=active]:bg-command-purple data-[state=active]:text-white"
            >
              Pendências
            </TabsTrigger>
            <TabsTrigger
              value="unplanned"
              className="text-[10px] uppercase font-bold px-4 py-2 data-[state=active]:bg-command-purple data-[state=active]:text-white"
            >
              Fora Roteiro
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="text-[10px] uppercase font-bold px-4 py-2 data-[state=active]:bg-command-purple data-[state=active]:text-white"
            >
              Manual
            </TabsTrigger>
            <TabsTrigger
              value="not_completed"
              className="text-[10px] uppercase font-bold px-4 py-2 data-[state=active]:bg-command-purple data-[state=active]:text-white"
            >
              Não Realizadas
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {listQ.isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            Nenhuma conciliação encontrada para os filtros atuais. Importe um checklist ou execute a
            conciliação.
          </div>
        ) : (
          <div className="overflow-auto max-h-[640px] border border-white/5 rounded-xl bg-white/[0.01]">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">
                    Planejada
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">
                    Realizada
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 text-right">
                    Δ Dias
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">
                    Promotor
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">
                    Loja
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">
                    UF
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4">
                    Indústria
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-4 text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => {
                  const st = r.status as ReconciliationStatus;
                  const isOpen = expanded === r.id;
                  return (
                    <>
                      <TableRow
                        key={r.id}
                        className={r.reviewed_manually ? "bg-primary/5" : undefined}
                      >
                        <TableCell>
                          <button
                            onClick={() => setExpanded(isOpen ? null : r.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${STATUS_TONE[st]}`}>
                            {STATUS_ICON[st]}
                            {STATUS_LABELS_PT[st]}
                          </Badge>
                        </TableCell>
                        <TableCell>{fmtDate(r.planned_date)}</TableCell>
                        <TableCell>{fmtDate(r.actual_date)}</TableCell>
                        <TableCell>{r.date_diff_days ?? "—"}</TableCell>
                        <TableCell>
                          {r.promoter?.name ??
                            (st === "UNPLANNED_VISIT" ? "Não identificado" : "—")}
                        </TableCell>
                        <TableCell>{r.store?.name ?? r.raw_store_name ?? "—"}</TableCell>
                        <TableCell>{r.store?.uf ?? r.raw_store_uf ?? "—"}</TableCell>
                        <TableCell>{r.industry?.name ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.match_type ?? "—"}
                        </TableCell>
                        <TableCell>{r.match_score ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <RowActions
                            row={r}
                            onReview={() => setReviewTarget(r)}
                            onLinkStore={() => setStoreTarget(r)}
                            onIgnore={() => setIgnoreTarget(r)}
                            onUndo={() => undoMut.mutate(r.id)}
                          />
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${r.id}-detail`}>
                          <TableCell colSpan={12} className="bg-muted/30">
                            <RowDetail id={r.id} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Página {page} de {totalPages} — {total} registros
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-28 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / pág
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Mk9Panel>

      {reviewTarget && (
        <ReviewDialog
          row={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onDone={() => {
            setReviewTarget(null);
            qc.invalidateQueries({ queryKey: ["mk9-reco"] });
          }}
        />
      )}
      {storeTarget && (
        <StoreLinkDialog
          row={storeTarget}
          onClose={() => setStoreTarget(null)}
          onDone={() => {
            setStoreTarget(null);
            qc.invalidateQueries({ queryKey: ["mk9-reco"] });
          }}
        />
      )}
      {ignoreTarget && (
        <IgnoreDialog
          row={ignoreTarget}
          pending={ignoreMut.isPending}
          onClose={() => setIgnoreTarget(null)}
          onConfirm={(notes) => ignoreMut.mutate({ id: ignoreTarget.id, notes })}
        />
      )}
    </div>
  );
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function RowActions({
  row,
  onReview,
  onLinkStore,
  onIgnore,
  onUndo,
}: {
  row: any;
  onReview: () => void;
  onLinkStore: () => void;
  onIgnore: () => void;
  onUndo: () => void;
}) {
  const st = row.status as ReconciliationStatus;
  const canReview =
    st === "AMBIGUOUS" ||
    st === "DATE_DIVERGENCE" ||
    st === "UNPLANNED_VISIT" ||
    st === "DUPLICATE_ACTUAL";
  const canLinkStore = st === "STORE_NOT_FOUND";
  const canUndo = row.reviewed_manually;

  return (
    <div className="inline-flex flex-wrap justify-end gap-1">
      {canReview && (
        <Button size="sm" variant="secondary" onClick={onReview}>
          <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
        </Button>
      )}
      {canLinkStore && (
        <Button size="sm" variant="secondary" onClick={onLinkStore}>
          <Link2 className="h-3.5 w-3.5 mr-1" /> Vincular loja
        </Button>
      )}
      {canUndo && (
        <Button size="sm" variant="ghost" onClick={onUndo}>
          <Undo2 className="h-3.5 w-3.5 mr-1" /> Desfazer
        </Button>
      )}
      {st !== "IGNORED" && (
        <Button size="sm" variant="ghost" onClick={onIgnore}>
          Ignorar
        </Button>
      )}
    </div>
  );
}

// ---------- Detalhe expandido ----------
function RowDetail({ id }: { id: string }) {
  const detailFn = useServerFn(reconcileDetail);
  const q = useQuery({
    queryKey: ["mk9-reco", "detail", id],
    queryFn: () => detailFn({ data: { id } }),
  });
  if (q.isLoading)
    return (
      <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhe…
      </div>
    );
  if (q.error || !q.data)
    return <div className="p-4 text-sm text-rose-300">Erro ao carregar detalhe.</div>;
  const { reconciliation: r, planned, actual, importInfo } = q.data;
  const weekday = planned?.scheduled_date
    ? WEEKDAY_PT[new Date(planned.scheduled_date + "T00:00:00Z").getUTCDay()]
    : null;

  return (
    <div className="grid gap-4 md:grid-cols-3 p-4">
      <DetailBlock title="Planejamento">
        {planned ? (
          <>
            <DetailRow k="Promotor" v={planned.promoter?.name ?? "—"} />
            <DetailRow k="Loja" v={`${planned.store?.name ?? "—"} · ${planned.store?.uf ?? "—"}`} />
            <DetailRow k="Indústria" v={planned.industry?.name ?? "—"} />
            <DetailRow k="Data" v={fmtDate(planned.scheduled_date)} />
            <DetailRow k="Dia da semana" v={weekday ?? "—"} />
            <DetailRow k="Roteiro" v={planned.route?.source_sheet ?? planned.source_sheet ?? "—"} />
          </>
        ) : (
          <span className="text-muted-foreground text-sm">Sem planejamento vinculado.</span>
        )}
      </DetailBlock>
      <DetailBlock title="Realizado">
        {actual ? (
          <>
            <DetailRow k="Loja" v={`${actual.store?.name ?? "—"} · ${actual.store?.uf ?? "—"}`} />
            <DetailRow k="Indústria" v={actual.industry?.name ?? "—"} />
            <DetailRow k="Data" v={fmtDate(actual.scheduled_date)} />
            <DetailRow k="Origem" v="Checklist" />
            <DetailRow k="Arquivo" v={importInfo?.filename ?? "—"} />
          </>
        ) : r.raw_store_name ? (
          <>
            <DetailRow k="Loja (bruto)" v={`${r.raw_store_name} · ${r.raw_store_uf ?? "—"}`} />
            <DetailRow k="Data" v={fmtDate(r.actual_date)} />
            <DetailRow k="Arquivo" v={importInfo?.filename ?? "—"} />
          </>
        ) : (
          <span className="text-muted-foreground text-sm">Sem realização registrada.</span>
        )}
      </DetailBlock>
      <DetailBlock title="Conciliação">
        <DetailRow k="Status" v={STATUS_LABELS_PT[r.status as ReconciliationStatus]} />
        <DetailRow k="Score" v={r.match_score} />
        <DetailRow k="Tipo" v={r.match_type ?? "—"} />
        <DetailRow k="Δ dias" v={r.date_diff_days ?? "—"} />
        <DetailRow k="Revisão manual" v={r.reviewed_manually ? "sim" : "não"} />
        <DetailRow k="Revisor" v={r.reviewed_by ?? "—"} />
        <DetailRow
          k="Data revisão"
          v={r.reviewed_at ? new Date(r.reviewed_at).toLocaleString("pt-BR") : "—"}
        />
        {r.notes && <DetailRow k="Observações" v={r.notes} />}
      </DetailBlock>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </div>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  );
}
function DetailRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[110px]">{k}:</span>
      <span className="flex-1 break-words">{v ?? "—"}</span>
    </div>
  );
}

// ---------- Modal de revisão (AMBIGUOUS / DATE_DIVERGENCE / UNPLANNED_VISIT / DUPLICATE_ACTUAL) ----------
function ReviewDialog({
  row,
  onClose,
  onDone,
}: {
  row: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const st = row.status as ReconciliationStatus;
  const isUnplanned = st === "UNPLANNED_VISIT" || st === "AMBIGUOUS" || st === "DUPLICATE_ACTUAL";
  const findFn = useServerFn(reconcileFindCandidates);
  const manualFn = useServerFn(reconcileManualMatch);
  const acceptFn = useServerFn(reconcileAcceptDivergence);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const candidatesQ = useQuery({
    queryKey: ["mk9-reco", "candidates", row.actual_visit_id],
    queryFn: () => findFn({ data: { actualVisitId: row.actual_visit_id, windowDays: 14 } }),
    enabled: !!row.actual_visit_id,
  });

  const linkMut = useMutation({
    mutationFn: () =>
      manualFn({
        data: {
          actualVisitId: row.actual_visit_id,
          plannedVisitId: selected!,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Vínculo manual salvo");
      onDone();
    },
    onError: (e: any) => toast.error(`Falha: ${e?.message ?? e}`),
  });
  const acceptMut = useMutation({
    mutationFn: () => acceptFn({ data: { reconciliationId: row.id, notes: notes || null } }),
    onSuccess: () => {
      toast.success("Divergência aceita");
      onDone();
    },
    onError: (e: any) => toast.error(`Falha: ${e?.message ?? e}`),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Revisão manual — {STATUS_LABELS_PT[st]}</DialogTitle>
          <DialogDescription>
            Realizada em {fmtDate(row.actual_date)} · {row.store?.name ?? row.raw_store_name ?? "—"}{" "}
            · {row.industry?.name ?? "—"}
          </DialogDescription>
        </DialogHeader>

        {st === "DATE_DIVERGENCE" && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm space-y-1">
            <div>
              Planejado: <strong>{fmtDate(row.planned_date)}</strong>
            </div>
            <div>
              Realizado: <strong>{fmtDate(row.actual_date)}</strong>
            </div>
            <div>
              Diferença: <strong>{row.date_diff_days} dia(s)</strong>
            </div>
          </div>
        )}

        {isUnplanned || st === "DATE_DIVERGENCE" ? (
          <div className="space-y-2 max-h-[360px] overflow-auto">
            <div className="text-xs text-muted-foreground">
              {candidatesQ.isLoading
                ? "Buscando candidatos…"
                : "Selecione uma visita planejada para vincular:"}
            </div>
            {(candidatesQ.data?.candidates ?? []).length === 0 && !candidatesQ.isLoading && (
              <div className="text-sm text-muted-foreground">
                Nenhum candidato encontrado em ±14 dias.
              </div>
            )}
            {(candidatesQ.data?.candidates ?? []).map((c: any) => (
              <label
                key={c.id}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selected === c.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40"}`}
              >
                <input
                  type="radio"
                  name="cand"
                  checked={selected === c.id}
                  onChange={() => setSelected(c.id)}
                  className="mt-1"
                />
                <div className="flex-1 text-sm">
                  <div className="font-medium">
                    {c.store?.name ?? "—"}{" "}
                    <span className="text-muted-foreground">· {c.store?.uf ?? "—"}</span>
                    {c.sameStore && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        mesma loja
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {c.promoter?.name ?? "—"} · {fmtDate(c.scheduled_date)} · Δ {c.diffDays} dia(s)
                  </div>
                </div>
              </label>
            ))}
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Observação (opcional)</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {st === "DATE_DIVERGENCE" && (
            <Button
              variant="secondary"
              onClick={() => acceptMut.mutate()}
              disabled={acceptMut.isPending}
            >
              {acceptMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Aceitar
              divergência
            </Button>
          )}
          <Button
            onClick={() => linkMut.mutate()}
            disabled={!selected || !row.actual_visit_id || linkMut.isPending}
          >
            {linkMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Vincular
            manualmente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Modal STORE_NOT_FOUND ----------
function StoreLinkDialog({
  row,
  onClose,
  onDone,
}: {
  row: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const searchFn = useServerFn(reconcileSearchStores);
  const linkFn = useServerFn(reconcileLinkStore);
  const [q, setQ] = useState(row.raw_store_name ?? "");
  const [uf, setUf] = useState<string>(row.raw_store_uf ?? "__ALL__");
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const dq = useDebouncedValue(q, 300);

  const storesQ = useQuery({
    queryKey: ["mk9-reco", "store-search", dq, uf],
    queryFn: () => searchFn({ data: { query: dq, uf: uf === "__ALL__" ? null : uf, limit: 30 } }),
  });

  const linkMut = useMutation({
    mutationFn: () =>
      linkFn({ data: { reconciliationId: row.id, storeId: selected!, notes: notes || null } }),
    onSuccess: () => {
      toast.success("Loja vinculada");
      onDone();
    },
    onError: (e: any) => toast.error(`Falha: ${e?.message ?? e}`),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vincular loja</DialogTitle>
          <DialogDescription>
            Loja original: <strong>{row.raw_store_name ?? "—"}</strong> · UF:{" "}
            {row.raw_store_uf ?? "—"} · Data: {fmtDate(row.actual_date)} · Indústria:{" "}
            {row.industry?.name ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar loja pelo nome…"
              className="pl-9"
            />
          </div>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Todas</SelectItem>
              {UFS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[320px] overflow-auto space-y-1.5">
          {storesQ.isLoading && <div className="text-sm text-muted-foreground">Buscando…</div>}
          {(storesQ.data ?? []).length === 0 && !storesQ.isLoading && (
            <div className="text-sm text-muted-foreground">Nenhuma loja encontrada.</div>
          )}
          {(storesQ.data ?? []).map((st: any) => (
            <label
              key={st.id}
              className={`flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer text-sm ${selected === st.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40"}`}
            >
              <input
                type="radio"
                name="store"
                checked={selected === st.id}
                onChange={() => setSelected(st.id)}
              />
              <div className="flex-1">
                <div className="font-medium">{st.name}</div>
                <div className="text-xs text-muted-foreground">
                  {st.chain ?? "—"} · {st.uf ?? "—"}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Observação (opcional)</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => linkMut.mutate()} disabled={!selected || linkMut.isPending}>
            {linkMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Modal de ignorar ----------
function IgnoreDialog({
  row,
  pending,
  onClose,
  onConfirm,
}: {
  row: any;
  pending: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ignorar conciliação</DialogTitle>
          <DialogDescription>
            {STATUS_LABELS_PT[row.status as ReconciliationStatus]} ·{" "}
            {row.store?.name ?? row.raw_store_name ?? "—"} ·{" "}
            {fmtDate(row.planned_date ?? row.actual_date)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Motivo / observação</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Ex.: loja fechada, promotor afastado, roteiro alterado…"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(notes)} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
