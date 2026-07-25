import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Ban, ShieldQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

import { mk9ListIndustries } from "@/lib/mk9-data.functions";
import { reconcileRun, reconcileSummary, reconcileList, reconcileIgnore } from "@/lib/mk9-reconciliation.functions";
import { STATUS_LABELS_PT, type ReconciliationStatus } from "@/lib/mk9-reconciliation/types";

const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
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

export function Mk9ReconciliationModule() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [industryId, setIndustryId] = useState<string>("__ALL__");

  const qc = useQueryClient();
  const industriesFn = useServerFn(mk9ListIndustries);
  const summaryFn = useServerFn(reconcileSummary);
  const listFn = useServerFn(reconcileList);
  const runFn = useServerFn(reconcileRun);
  const ignoreFn = useServerFn(reconcileIgnore);

  const scope = useMemo(
    () => ({
      operationYear: year,
      operationMonth: month,
      industryId: industryId === "__ALL__" ? null : industryId,
    }),
    [year, month, industryId],
  );

  const industriesQ = useQuery({ queryKey: ["mk9", "industries"], queryFn: () => industriesFn() });
  const summaryQ = useQuery({
    queryKey: ["mk9-reco", "summary", scope],
    queryFn: () => summaryFn({ data: scope }),
  });
  const listQ = useQuery({
    queryKey: ["mk9-reco", "list", scope],
    queryFn: () => listFn({ data: scope }),
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
    mutationFn: (id: string) => ignoreFn({ data: { reconciliationId: id } }),
    onSuccess: () => {
      toast.success("Marcado como ignorado");
      qc.invalidateQueries({ queryKey: ["mk9-reco"] });
    },
  });

  const s = summaryQ.data;
  const rows = (listQ.data ?? []) as any[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conciliação de visitas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ano</label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mês</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS_PT.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[220px]">
              <label className="text-xs text-muted-foreground">Indústria</label>
              <Select value={industryId} onValueChange={setIndustryId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Todas as indústrias</SelectItem>
                  {(industriesQ.data ?? []).map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => runMut.mutate()} disabled={runMut.isPending}>
              {runMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Executar conciliação
            </Button>
          </div>

          {s && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <SummaryCell label="Planejadas" value={s.planned} icon={<HelpCircle className="h-4 w-4" />} />
              <SummaryCell label="Realizadas" value={s.actual} icon={<CheckCircle2 className="h-4 w-4" />} />
              <SummaryCell label="Conciliadas" value={s.matched} tone="text-emerald-300" />
              <SummaryCell label="Data divergente" value={s.dateDivergence} tone="text-amber-300" icon={<AlertTriangle className="h-4 w-4" />} />
              <SummaryCell label="Fora do roteiro" value={s.unplanned} tone="text-sky-300" />
              <SummaryCell label="Não realizadas" value={s.notCompleted} tone="text-rose-300" icon={<XCircle className="h-4 w-4" />} />
              <SummaryCell label="Ambíguas" value={s.ambiguous} tone="text-orange-300" icon={<ShieldQuestion className="h-4 w-4" />} />
              <SummaryCell label="Loja não encontrada" value={s.storeNotFound} tone="text-fuchsia-300" />
              <SummaryCell label="Duplicadas" value={s.duplicate} tone="text-yellow-300" />
              <SummaryCell label="Manuais" value={s.manuallyMatched} tone="text-teal-300" />
              <SummaryCell label="Ignoradas" value={s.ignored} icon={<Ban className="h-4 w-4" />} />
              <SummaryCell label="Cobertura" value={`${s.coveragePct}%`} tone="text-primary" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registros ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum resultado. Execute a conciliação para o período selecionado.</p>
          ) : (
            <div className="overflow-auto max-h-[560px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Indústria</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Promotor</TableHead>
                    <TableHead>Planejada</TableHead>
                    <TableHead>Realizada</TableHead>
                    <TableHead>Δ dias</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_TONE[r.status as ReconciliationStatus]}>
                          {STATUS_LABELS_PT[r.status as ReconciliationStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.industry?.name ?? "—"}</TableCell>
                      <TableCell>
                        {r.store?.name ?? r.raw_store_name ?? "—"}
                        {r.store?.uf || r.raw_store_uf ? <span className="text-muted-foreground"> · {r.store?.uf ?? r.raw_store_uf}</span> : null}
                      </TableCell>
                      <TableCell>{r.promoter?.name ?? "—"}</TableCell>
                      <TableCell>{r.planned_date ?? "—"}</TableCell>
                      <TableCell>{r.actual_date ?? "—"}</TableCell>
                      <TableCell>{r.date_diff_days ?? "—"}</TableCell>
                      <TableCell>{r.match_score}</TableCell>
                      <TableCell className="text-right">
                        {r.status !== "IGNORED" && (
                          <Button size="sm" variant="ghost" onClick={() => ignoreMut.mutate(r.id)}>
                            Ignorar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCell({ label, value, tone, icon }: { label: string; value: number | string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
