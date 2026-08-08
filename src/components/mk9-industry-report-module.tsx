import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Settings2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";
import {
  reportIndustry,
  reportIndustryPeriodConfig,
  reportUpsertPeriodConfig,
  reportListChecklistImports,
} from "@/lib/mk9-reports.functions";
import { buildIndustryReportFilename } from "@/lib/mk9/normalization";
import { Mk9PageHeader, Mk9MetricCard, Mk9Panel, Mk9Badge } from "./mk9/design-system";


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

const EXEC_TONE: Record<string, "success" | "warning" | "danger" | "default"> = {
  INTEGRAL: "success",
  PARCIAL: "warning",
  NAO_ATENDIDA: "danger",
};
const EXEC_LABEL: Record<string, string> = {
  INTEGRAL: "Integral",
  PARCIAL: "Parcial",
  NAO_ATENDIDA: "Não atendida",
};
const ROUTE_TONE: Record<string, "info" | "warning" | "default"> = {
  DENTRO_ROTEIRO: "info",
  FORA_ROTEIRO: "warning",
};
const ROUTE_LABEL: Record<string, string> = {
  DENTRO_ROTEIRO: "No Roteiro",
  FORA_ROTEIRO: "Fora Roteiro",
};

const SOURCE_LABEL: Record<string, string> = {
  WEEKLY_FREQUENCY: "Freq. semanal",
  MONTHLY_FREQUENCY: "Freq. mensal",
  NONE: "Sem contrato",
};

function fmtBR(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function Mk9IndustryReportModule({ initialMonth, initialYear }: { initialMonth?: number; initialYear?: number }) {
  const [industryId, setIndustryId] = useState<string>("");
  const [month, setMonth] = useState<number>(initialMonth || new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(initialYear || new Date().getFullYear());
  const [uf, setUf] = useState<string>("");
  const [sourceImportId, setSourceImportId] = useState<string>("");

  const industriesFn = useServerFn(mk9ListIndustries);
  const reportFn = useServerFn(reportIndustry);
  const importsFn = useServerFn(reportListChecklistImports);

  useEffect(() => {
    if (initialMonth) setMonth(initialMonth);
  }, [initialMonth]);

  useEffect(() => {
    if (initialYear) setYear(initialYear);
  }, [initialYear]);

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn() });

  const reportQ = useQuery({
    enabled: !!industryId,
    queryKey: ["report-industry", industryId, year, month, uf, sourceImportId],
    queryFn: () =>
      reportFn({
        data: {
          industryId,
          year,
          month,
          uf: uf || null,
          sourceImportId: sourceImportId || null,
        },
      }),
  });

  const importsQ = useQuery({
    enabled: !!industryId,
    queryKey: ["report-imports", industryId, year, month],
    queryFn: () => importsFn({ data: { industryId, year, month } }),
  });

  const report = reportQ.data;
  const ufOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of report?.stores ?? []) if (s.uf) set.add(s.uf);
    return Array.from(set).sort();
  }, [report]);

  const [downloading, setDownloading] = useState<"full" | "unattended" | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function downloadPdf(type: "full" | "unattended") {
    if (!industryId) return;
    if (typeof window === "undefined") return;
    setDownloading(type);
    setPdfError(null);
    const label = type === "full" ? "PDF completo" : "Lojas não atendidas";
    const toastId = toast.loading(`Gerando ${label}...`);
    try {
      const endpoint =
        type === "full" ? "/api/reports/industry-pdf" : "/api/reports/industry-unattended-pdf";
      const { mk9AuthHeaders } = await import("@/lib/mk9-auth/fetch-headers");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await mk9AuthHeaders()) },
        cache: "no-store",
        body: JSON.stringify({
          industryId,
          year,
          month,
          uf: uf || null,
          checklistImportId: sourceImportId || null,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.message ?? j?.error ?? msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/pdf")) throw new Error(`Resposta inesperada: ${ct}`);
      const cd = res.headers.get("content-disposition") ?? "";
      
      const industryName = industriesQ.data?.find(i => i.id === industryId)?.name || "Indústria";
      const filename = buildIndustryReportFilename({
        industryName,
        month,
        year,
        reportType: type === "full" ? "FULL" : "UNVISITED_STORES"
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${label} gerado`, { id: toastId });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setPdfError(msg);
      toast.error(msg, { id: toastId });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <Mk9PageHeader
        title="Indústrias — Relatório Operacional"
        subtitle="Acompanhamento de frequência, execução e cobertura"
        icon={FileText}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodConfigDialog industryId={industryId} />
          </div>
        }
      />

      <Mk9Panel>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="sm:col-span-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Indústria
            </Label>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                {(industriesQ.data ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Mês
            </Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 min-w-[130px] bg-command-deep border-white/10 text-white uppercase px-3 gap-2 shrink-0">
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
          <div>
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Ano
            </Label>
            <Input
              type="number"
              className="h-9 bg-command-deep border-white/10 text-white"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              UF
            </Label>
            <Select value={uf || "__all"} onValueChange={(v) => setUf(v === "__all" ? "" : v)}>
              <SelectTrigger className="h-9 bg-command-deep border-white/10 text-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                <SelectItem value="__all">Todas</SelectItem>
                {ufOptions.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Mk9Panel>

      {!industryId && (
        <Mk9Panel className="py-20 text-center">
          <p className="text-slate-500">
            Selecione uma indústria para visualizar os dados e gerar relatórios.
          </p>
        </Mk9Panel>
      )}

      {industryId && reportQ.isLoading && (
        <Mk9Panel className="py-20 text-center flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-mk9-accent-primary" />
          <p className="text-slate-400">Calculando indicadores operacionais...</p>
        </Mk9Panel>
      )}

      {reportQ.isError && (
        <Mk9Panel className="py-10 text-rose-500 border-rose-500/20 bg-rose-500/5">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p>{(reportQ.error as any)?.message ?? "Falha ao carregar relatório"}</p>
          </div>
        </Mk9Panel>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Mk9MetricCard label="Lojas" value={report.totals.totalStores} color="blue" />
            <Mk9MetricCard
              label="Contratadas"
              value={report.totals.metrics.contratadas}
              color="purple"
            />
            <Mk9MetricCard
              label="Realizadas"
              value={report.totals.metrics.executadas}
              color="emerald"
              hint={`${report.totals.metrics.coberturaPct}% cobertura`}
            />
            <Mk9MetricCard
              label="Pendentes"
              value={report.totals.metrics.pendencias}
              color="amber"
            />
            <Mk9MetricCard label="Extras" value={report.totals.metrics.extras} color="blue" />
            <Mk9MetricCard
              label="Cobertura"
              value={`${report.totals.metrics.coberturaPct}%`}
              color={report.totals.metrics.coberturaPct >= 90 ? "emerald" : "amber"}
            />
          </div>

          <Mk9Panel className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Período de Competência
              </p>
              <p className="text-white font-medium">
                {fmtBR(report.window.startDate)} a {fmtBR(report.window.endDate)}{" "}
                <span className="text-slate-500 ml-2">· {report.window.totalDays} dias</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <Button
                onClick={() => downloadPdf("full")}
                disabled={!!downloading}
                variant="outline"
                className="h-9 border-white/10 text-slate-400 hover:text-white hover:bg-white/5 uppercase text-[10px] font-black tracking-widest"
              >
                {downloading === "full" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar Relatório
              </Button>
              <Button
                onClick={() => downloadPdf("unattended")}
                disabled={!!downloading}
                className="h-9 w-full sm:w-auto bg-command-purple hover:bg-command-purple/80 text-white border-none shadow-[0_0_15px_rgba(168,85,247,0.3)] uppercase text-[10px] font-black tracking-widest"
              >
                {downloading === "unattended" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Lojas não atendidas
              </Button>
            </div>
          </Mk9Panel>

          {pdfError && (
            <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs">
              {pdfError}
            </div>
          )}

          {report.ufs.length > 0 && (
            <Mk9Panel title="Resumo por UF">
              <div className="overflow-x-auto custom-scrollbar-horizontal">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                      <th className="pb-3 font-bold text-left">UF</th>
                      <th className="pb-3 font-bold text-right">Lojas</th>
                      <th className="pb-3 font-bold text-right">Contratadas</th>
                      <th className="pb-3 font-bold text-right">Realizadas</th>
                      <th className="pb-3 font-bold text-right">Pendentes</th>
                      <th className="pb-3 font-bold text-right">Extras</th>
                      <th className="pb-3 font-bold text-right">Cobertura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 whitespace-nowrap lg:whitespace-normal">
                    {report.ufs.map((u) => (
                      <tr key={u.uf} className="group hover:bg-white/[0.02]">
                        <td className="py-3 text-white font-medium">{u.uf}</td>
                        <td className="py-3 text-slate-300 text-right">{u.stores}</td>
                        <td className="py-3 text-slate-300 text-right">{u.expected}</td>
                        <td className="py-3 text-white text-right">{u.actual}</td>
                        <td className="py-3 text-slate-400 text-right">{u.pending}</td>
                        <td className="py-3 text-slate-400 text-right">{u.extra}</td>
                        <td className="py-3 text-right">
                          <Mk9Badge variant={u.coveragePct >= 90 ? "success" : "warning"}>
                            {u.coveragePct}%
                          </Mk9Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Mk9Panel>
          )}

          <Mk9Panel title="Detalhamento por Loja">
            <div className="overflow-x-auto custom-scrollbar-horizontal">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                    <th className="pb-3 font-bold text-left">Loja</th>
                    <th className="pb-3 font-bold text-left">UF</th>
                    <th className="pb-3 font-bold text-left">Freq.</th>
                    <th className="pb-3 font-bold text-right">Contratadas</th>
                    <th className="pb-3 font-bold text-right">Realizadas</th>
                    <th className="pb-3 font-bold text-right">Cobertura</th>
                    <th className="pb-3 font-bold text-right">Execução</th>
                    <th className="pb-3 font-bold text-right">Roteiro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 whitespace-nowrap lg:whitespace-normal">
                  {report.stores.map((s: any) => {
                    const freqLabel =
                      s.frequencyLabel ??
                      (s.monthlyFrequency
                        ? `${s.monthlyFrequency}/mês`
                        : s.weeklyFrequency
                          ? `${s.weeklyFrequency}/sem`
                          : "—");
                    return (
                      <tr key={s.storeId} className="group hover:bg-white/[0.02]">
                        <td className="py-3">
                          <div className="text-white font-medium">{s.storeName}</div>
                          {s.chain && (
                            <div className="text-[10px] text-slate-500 uppercase tracking-tighter">
                              {s.chain}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-slate-400 font-mono">{s.uf ?? "—"}</td>
                        <td className="py-3 text-slate-400 text-xs">{freqLabel}</td>
                        <td className="py-3 text-slate-300 font-medium text-right">{s.expected}</td>
                        <td className="py-3 text-white font-bold text-right">{s.actual}</td>
                        <td className="py-3 text-right">
                          <Mk9Badge
                            variant={
                              s.coveragePct >= 90
                                ? "success"
                                : s.coveragePct >= 70
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {s.coveragePct}%
                          </Mk9Badge>
                        </td>
                        <td className="py-3 text-right">
                          <Mk9Badge variant={EXEC_TONE[s.executionStatus] as any}>
                            {EXEC_LABEL[s.executionStatus]}
                          </Mk9Badge>
                        </td>
                        <td className="py-3 text-right">
                          <Mk9Badge variant={ROUTE_TONE[s.routeStatus] as any}>
                            {ROUTE_LABEL[s.routeStatus]}
                          </Mk9Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Mk9Panel>
        </>
      )}
    </div>
  );
}

function PeriodConfigDialog({ industryId }: { industryId: string }) {
  const [open, setOpen] = useState(false);
  const loadFn = useServerFn(reportIndustryPeriodConfig);
  const saveFn = useServerFn(reportUpsertPeriodConfig);
  const q = useQuery({
    enabled: open && !!industryId,
    queryKey: ["period-config", industryId],
    queryFn: () => loadFn({ data: { industryId } }),
  });
  const [form, setForm] = useState<any>(null);
  const mut = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => {
      setOpen(false);
      toast.success("Configuração salva com sucesso");
    },
  });

  const current = form ?? q.data;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setForm(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-9 border-white/10 hover:bg-white/5 text-slate-300"
          disabled={!industryId}
        >
          <Settings2 className="mr-2 h-4 w-4" /> CONFIGURAR PERÍODO
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-command-deep border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-mk9-accent-primary">
            Configuração de Competência
          </DialogTitle>
        </DialogHeader>
        {!current ? (
          <div className="py-10 text-center text-slate-500 flex flex-col items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Carregando configurações...</p>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Tipo de Período
              </Label>
              <Select
                value={current.periodType}
                onValueChange={(v) => setForm({ ...current, periodType: v })}
              >
                <SelectTrigger className="bg-black/40 border-white/10 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-command-deep border-white/10">
                  <SelectItem value="CALENDAR_MONTH">Mês calendário (dia 1 ao último)</SelectItem>
                  <SelectItem value="CUSTOM_CYCLE">Ciclo personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Dia Inicial
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  className="bg-black/40 border-white/10 h-10"
                  value={current.startDay}
                  onChange={(e) => setForm({ ...current, startDay: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Dia Final
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  className="bg-black/40 border-white/10 h-10"
                  value={current.endDay}
                  onChange={(e) => setForm({ ...current, endDay: Number(e.target.value) || 31 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
              <Switch
                checked={current.usesPreviousMonth}
                onCheckedChange={(v) => setForm({ ...current, usesPreviousMonth: v })}
              />
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Ciclo começa no mês anterior</p>
                <p className="text-[10px] text-slate-500">
                  Ex: KING (23 do mês anterior ao 22 atual)
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Agrupamento Semanal
              </Label>
              <Select
                value={current.weekGrouping}
                onValueChange={(v) => setForm({ ...current, weekGrouping: v })}
              >
                <SelectTrigger className="bg-black/40 border-white/10 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-command-deep border-white/10">
                  <SelectItem value="CALENDAR_WEEK">Segunda a domingo</SelectItem>
                  <SelectItem value="CYCLE_WEEK">Blocos de 7 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mut.isError && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                {(mut.error as any)?.message ?? "Erro ao salvar"}
              </div>
            )}
          </div>
        )}
        <DialogFooter className="mt-6 border-t border-white/5 pt-4">
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white"
            onClick={() => setOpen(false)}
          >
            CANCELAR
          </Button>
          <Button
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-white font-bold"
            onClick={() =>
              mut.mutate({
                industryId,
                periodType: current.periodType,
                startDay: current.startDay,
                endDay: current.endDay,
                usesPreviousMonth: current.usesPreviousMonth,
                weekGrouping: current.weekGrouping,
                active: true,
                notes: null,
              })
            }
            disabled={!current || mut.isPending}
          >
            {mut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "SALVAR CONFIGURAÇÃO"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
