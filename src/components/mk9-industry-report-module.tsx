// Tela: Relatórios › Indústrias
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Settings2, AlertCircle, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { BulkExportModal } from "./mk9-bulk-export-modal";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";
import {
  reportIndustry,
  reportIndustryPeriodConfig,
  reportUpsertPeriodConfig,
  reportListChecklistImports,
} from "@/lib/mk9-reports.functions";

const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const EXEC_TONE: Record<string, string> = {
  INTEGRAL: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  PARCIAL: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  NAO_ATENDIDA: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};
const EXEC_LABEL: Record<string, string> = {
  INTEGRAL: "Integral",
  PARCIAL: "Parcial",
  NAO_ATENDIDA: "Não atendida",
};
const ROUTE_TONE: Record<string, string> = {
  DENTRO_ROTEIRO: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  FORA_ROTEIRO: "bg-orange-500/15 text-orange-700 border-orange-500/30",
};
const ROUTE_LABEL: Record<string, string> = {
  DENTRO_ROTEIRO: "Dentro do roteiro",
  FORA_ROTEIRO: "Fora do roteiro",
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

export function Mk9IndustryReportModule() {
  const now = new Date();
  const [industryId, setIndustryId] = useState<string>("");
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [uf, setUf] = useState<string>("");
  const [sourceImportId, setSourceImportId] = useState<string>("");

  const industriesFn = useServerFn(mk9ListIndustries);
  const reportFn = useServerFn(reportIndustry);
  const importsFn = useServerFn(reportListChecklistImports);

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn() });

  const reportQ = useQuery({
    enabled: !!industryId,
    queryKey: ["report-industry", industryId, year, month, uf, sourceImportId],
    queryFn: () => reportFn({ data: {
      industryId, year, month,
      uf: uf || null,
      sourceImportId: sourceImportId || null,
    } }),
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
    setDownloading(type); setPdfError(null);
    const label = type === "full" ? "PDF completo" : "Lojas não atendidas";
    const toastId = toast.loading(`Gerando ${label}...`);
    try {
      const endpoint = type === "full" ? "/api/reports/industry-pdf" : "/api/reports/industry-unattended-pdf";
      const { mk9AuthHeaders } = await import("@/lib/mk9-auth/fetch-headers");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await mk9AuthHeaders()) },
        cache: "no-store",
        body: JSON.stringify({
          industryId, year, month,
          uf: uf || null,
          checklistImportId: sourceImportId || null,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.message ?? j?.error ?? msg;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/pdf")) throw new Error(`Resposta inesperada: ${ct}`);
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? (type === "full" ? "relatorio.pdf" : "nao_atendidas.pdf");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${label} gerado`, { id: toastId });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.error("[INDUSTRY PDF]", e);
      setPdfError(msg);
      toast.error(msg, { id: toastId });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Relatório da Indústria</h2>
          <p className="text-sm text-muted-foreground">Documento consolidado para envio ao cliente. Números calculados a partir das visitas planejadas e realizadas.</p>
        </div>
        <div className="flex items-center gap-2">
          <BulkExportModal />
          <PeriodConfigDialog industryId={industryId} />
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-6 md:grid-cols-6">
          <div className="col-span-2">
            <Label className="text-xs">Indústria</Label>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {(industriesQ.data ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mês</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS_PT.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ano</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
          </div>
          <div>
            <Label className="text-xs">UF</Label>
            <Select value={uf || "__all"} onValueChange={(v) => setUf(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                {ufOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Checklist</Label>
            <Select value={sourceImportId || "__all"} onValueChange={(v) => setSourceImportId(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {(importsQ.data ?? []).map((imp: any) => (
                  <SelectItem key={imp.id} value={imp.id}>{imp.filename}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!industryId && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Selecione uma indústria para gerar o relatório.</CardContent></Card>
      )}

      {industryId && reportQ.isLoading && (
        <Card><CardContent className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando indicadores...</CardContent></Card>
      )}

      {reportQ.isError && (
        <Card><CardContent className="py-6 text-sm text-rose-600"><AlertCircle className="mr-2 inline h-4 w-4" />{(reportQ.error as any)?.message ?? "Falha ao carregar relatório"}</CardContent></Card>
      )}

      {report && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <div className="text-sm">
              <div className="text-muted-foreground">Período analisado</div>
              <div className="font-semibold">{fmtBR(report.window.startDate)} a {fmtBR(report.window.endDate)} · {report.window.totalDays} dias</div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => downloadPdf("full")} disabled={!!downloading} variant="outline" size="sm">
                {downloading === "full" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Relatório completo
              </Button>
              <Button onClick={() => downloadPdf("unattended")} disabled={!!downloading} size="sm">
                {downloading === "unattended" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Lojas não atendidas
              </Button>
            </div>
          </div>
          {pdfError && <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700">{pdfError}</div>}

          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Lojas" value={report.totals.totalStores} />
            <Kpi label="Visitas contratadas" value={report.totals.metrics.contratadas} />
            <Kpi label="Visitas realizadas" value={report.totals.metrics.executadas} tone="good" />
            <Kpi label="Visitas pendentes" value={report.totals.metrics.pendencias} tone="bad" />
            <Kpi label="Extras" value={report.totals.metrics.extras} tone="warn" />
            <Kpi label="Cobertura" value={`${report.totals.metrics.coberturaPct}%`} tone={report.totals.metrics.coberturaPct >= 90 ? "good" : report.totals.metrics.coberturaPct >= 70 ? "warn" : "bad"} />
            <Kpi label="Cobertura operacional" value={`${report.totals.operationalCoveragePct}%`} tone={report.totals.operationalCoveragePct >= 90 ? "good" : report.totals.operationalCoveragePct >= 70 ? "warn" : "bad"} />
            <Kpi label="Fora do roteiro" value={report.totals.unplanned} tone="warn" />
          </div>

          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Critério de cálculo</p>
            <p className="mt-1">
              <strong>Contratadas</strong> = soma da coluna VISITA MENSAL por loja. <strong>Realizadas</strong> = TODAS as visitas confirmadas no checklist (nunca reduzido, mesmo acima do contrato). <strong>Pendentes</strong> = max(0, contratadas − realizadas) por loja. <strong>Extras</strong> = max(0, realizadas − contratadas) por loja, indicador separado. <strong>Cobertura</strong> = realizadas / contratadas, limitada a 100 %. <strong>Roteiro</strong> é auditoria separada.
            </p>
          </div>


          {report.ufs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Resumo por UF</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="py-2">UF</th><th>Lojas</th><th>Contratadas</th><th>Realizadas</th><th>Pendentes</th><th>Extras</th><th>Cobertura</th></tr>
                  </thead>
                  <tbody>
                    {report.ufs.map((u) => (
                      <tr key={u.uf} className="border-b last:border-0">
                        <td className="py-2 font-medium">{u.uf}</td>
                        <td>{u.stores}</td>
                        <td>{u.expected}</td>
                        <td>{u.actual}</td>
                        <td>{u.pending}</td>
                        <td>{u.extra}</td>
                        <td>{u.coveragePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Resultado por loja</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Loja</th>
                    <th>UF</th>
                    <th>Freq.</th>
                    <th>Fonte</th>
                    <th>Contratadas</th>
                    <th>Realizadas</th>
                    <th>Pendentes</th>
                    <th>Extras</th>
                    <th>Cobertura</th>
                    <th>Execução</th>
                    <th>Roteiro</th>
                    <th>Datas realizadas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.stores.map((s: any) => {
                    // Fase 1B.3: mostra a composição da vigência quando a
                    // frequência mudou no meio do período.
                    const freqLabel =
                      s.frequencyLabel ??
                      (s.monthlyFrequency ? `${s.monthlyFrequency}/mês` :
                       s.weeklyFrequency ? `${s.weeklyFrequency}/sem` : "—");

                    return (
                      <tr key={s.storeId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2">
                          <div className="font-medium">{s.storeName}</div>
                          {s.chain && <div className="text-xs text-muted-foreground">{s.chain}</div>}
                        </td>
                        <td>{s.uf ?? "—"}</td>
                        <td className="text-xs">{freqLabel}</td>
                        <td className="text-xs text-muted-foreground">{SOURCE_LABEL[s.contractedSource] ?? s.contractedSource}</td>
                        <td>{s.expected}</td>
                        <td>{s.actual}</td>
                        <td>{s.pending}</td>
                        <td>{s.extra}</td>
                        <td>{s.coveragePct}%</td>
                        <td><Badge variant="outline" className={EXEC_TONE[s.executionStatus]}>{EXEC_LABEL[s.executionStatus]}</Badge></td>
                        <td><Badge variant="outline" className={ROUTE_TONE[s.routeStatus]}>{ROUTE_LABEL[s.routeStatus]}</Badge></td>
                        <td className="max-w-[240px] text-xs text-muted-foreground">{s.actualDates.length ? s.actualDates.map(fmtBR).join(", ") : "—"}</td>
                      </tr>
                    );
                  })}
                  {report.stores.length === 0 && (
                    <tr><td colSpan={12} className="py-6 text-center text-muted-foreground">Nenhuma loja no período com esses filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "warn" | "bad" }) {
  const toneCls =
    tone === "good" ? "border-emerald-500/40" :
    tone === "warn" ? "border-amber-500/40" :
    tone === "bad"  ? "border-rose-500/40" :
    "border-border";
  return (
    <div className={`rounded-lg border bg-card p-4 ${toneCls}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function PeriodConfigDialog({ industryId }: { industryId: string }) {
  const [open, setOpen] = useState(false);
  const loadFn = useServerFn(reportIndustryPeriodConfig);
  const saveFn = useServerFn(reportUpsertPeriodConfig);
  const q = useQuery({ enabled: open && !!industryId, queryKey: ["period-config", industryId], queryFn: () => loadFn({ data: { industryId } }) });
  const [form, setForm] = useState<any>(null);
  const mut = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => setOpen(false),
  });

  const current = form ?? q.data;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!industryId}><Settings2 className="mr-2 h-4 w-4" /> Configurar período</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Configuração de competência</DialogTitle></DialogHeader>
        {!current ? (
          <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando...</div>
        ) : (
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Tipo de período</Label>
              <Select value={current.periodType} onValueChange={(v) => setForm({ ...current, periodType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALENDAR_MONTH">Mês calendário (dia 1 ao último)</SelectItem>
                  <SelectItem value="CUSTOM_CYCLE">Ciclo personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dia inicial</Label>
                <Input type="number" min={1} max={31} value={current.startDay} onChange={(e) => setForm({ ...current, startDay: Number(e.target.value) || 1 })} />
              </div>
              <div>
                <Label className="text-xs">Dia final</Label>
                <Input type="number" min={1} max={31} value={current.endDay} onChange={(e) => setForm({ ...current, endDay: Number(e.target.value) || 31 })} />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={current.usesPreviousMonth} onCheckedChange={(v) => setForm({ ...current, usesPreviousMonth: v })} />
              Ciclo começa no mês anterior (ex.: KING = dia 23 do mês anterior ao 22 do mês selecionado)
            </label>
            <div>
              <Label className="text-xs">Agrupamento semanal</Label>
              <Select value={current.weekGrouping} onValueChange={(v) => setForm({ ...current, weekGrouping: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALENDAR_WEEK">Segunda a domingo</SelectItem>
                  <SelectItem value="CYCLE_WEEK">Blocos de 7 dias a partir do início do ciclo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mut.isError && <div className="text-sm text-rose-600">{(mut.error as any)?.message ?? "Erro ao salvar"}</div>}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => mut.mutate({
              industryId,
              periodType: current.periodType,
              startDay: current.startDay,
              endDay: current.endDay,
              usesPreviousMonth: current.usesPreviousMonth,
              weekGrouping: current.weekGrouping,
              active: true,
              notes: null,
            })}
            disabled={!current || mut.isPending}
          >
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
