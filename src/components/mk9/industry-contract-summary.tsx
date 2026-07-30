/**
 * MK9 — Resumo contrato × distribuição e aplicação de frequência em lote.
 *
 * A interface é apenas apresentação: seleção, prévia, conflitos e permissão são
 * SEMPRE recalculados no servidor. Nada é gravado antes da confirmação.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BULK_KIND_LABEL,
  BULK_MODE_LABEL,
  CONTRACT_STATUS_LABEL,
  type BulkApplyMode,
} from "@/lib/mk9-frequency/bulk";
import { FREQUENCY_ADMIN_CACHE_KEYS } from "@/lib/mk9-frequency/admin";
import { describeFrequency } from "@/lib/mk9-frequency/canonical";
import {
  mk9AcceptContractDivergence,
  mk9BulkFrequencyApply,
  mk9BulkFrequencyPreview,
  mk9IndustryContractSummary,
  mk9SetIndustryContractTotal,
} from "@/lib/mk9-frequency-bulk.functions";

const todayIso = () => new Date().toISOString().slice(0, 10);

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parseFreq(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function errorMessage(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : "";
  return msg && msg.length < 240 ? msg : fallback;
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    for (const key of [...FREQUENCY_ADMIN_CACHE_KEYS, "mk9-contract-summary"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

const STATUS_TONE: Record<string, string> = {
  CONFERIDO: "bg-emerald-500/10 text-emerald-700",
  ABAIXO_DO_CONTRATO: "bg-amber-500/10 text-amber-700",
  ACIMA_DO_CONTRATO: "bg-amber-500/10 text-amber-700",
  SEM_TOTAL_INFORMADO: "bg-muted text-muted-foreground",
};

// ---------------------------------------------------------------------------
// A. Resumo do contrato + B. Distribuição por frequência + C. Ações em lote
// ---------------------------------------------------------------------------
export function IndustryContractSummary({
  industryId,
  isAdmin,
}: {
  industryId: string;
  isAdmin: boolean;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [totalOpen, setTotalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);

  const summaryFn = useServerFn(mk9IndustryContractSummary);
  const q = useQuery({
    queryKey: ["mk9-contract-summary", industryId, month, year],
    queryFn: () =>
      summaryFn({ data: { industryId, competenceMonth: month, competenceYear: year } }),
  });

  const check = q.data?.check;
  const groups = q.data?.groups ?? [];
  const years = useMemo(
    () => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Contrato × distribuição</span>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-8 w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {isAdmin && (
          <>
            <Button size="sm" variant="outline" onClick={() => setTotalOpen(true)}>
              Informar total contratado
            </Button>
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              Aplicar frequência em lote
            </Button>
          </>
        )}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Calculando distribuição…</p>}

      {check && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <Metric label="Total contratado" value={check.contractedTotal ?? "—"} />
            <Metric label="Total distribuído" value={check.distributedTotal} />
            <Metric
              label="Diferença"
              value={check.difference === null ? "—" : check.difference > 0 ? `+${check.difference}` : check.difference}
            />
            <Metric
              label="Diferença %"
              value={check.differencePercentage === null ? "—" : `${check.differencePercentage}%`}
            />
            <Metric label="Lojas com frequência" value={check.storesWithFrequency} />
            <Metric label="Lojas sem frequência" value={check.storesWithoutFrequency} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_TONE[check.status]}`}>
              {CONTRACT_STATUS_LABEL[check.status as keyof typeof CONTRACT_STATUS_LABEL]}
            </span>
            {check.message && <span className="text-sm text-muted-foreground">{check.message}</span>}
            {isAdmin && check.message && (
              <Button size="sm" variant="ghost" onClick={() => setAcceptOpen(true)}>
                Aceitar diferença com justificativa
              </Button>
            )}
          </div>

          {q.data?.period && (
            <p className="text-xs text-muted-foreground">
              Período operacional: {q.data.period.start} → {q.data.period.end}
            </p>
          )}

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">Distribuição por frequência</p>
            {groups.length === 0 && <p className="text-sm text-muted-foreground">Sem lojas vinculadas.</p>}
            {groups.map((g: any) => (
              <div key={g.label} className="flex items-center justify-between rounded-md bg-background px-3 py-1.5 text-sm">
                <span className="font-medium">{g.label}</span>
                <span className="text-muted-foreground">
                  {g.stores} loja(s) — <span className="tabular-nums">{g.visits}</span> visita(s)
                </span>
              </div>
            ))}
            {groups.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{check.distributedTotal} visitas</span>
              </div>
            )}
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <ContractTotalDialog
            open={totalOpen}
            onClose={() => setTotalOpen(false)}
            industryId={industryId}
            month={month}
            year={year}
            current={check?.contractedTotal ?? null}
            expectedUpdatedAt={(q.data as any)?.contract?.updatedAt ?? null}
          />
          <BulkFrequencyDialog
            open={bulkOpen}
            onClose={() => setBulkOpen(false)}
            industryId={industryId}
            month={month}
            year={year}
          />
          <AcceptDivergenceDialog
            open={acceptOpen}
            onClose={() => setAcceptOpen(false)}
            industryId={industryId}
            month={month}
            year={year}
            contractedTotal={check?.contractedTotal ?? 0}
            distributedTotal={check?.distributedTotal ?? 0}
          />
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md bg-background p-2">
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Total contratado
// ---------------------------------------------------------------------------
function ContractTotalDialog({
  open,
  onClose,
  industryId,
  month,
  year,
  current,
  expectedUpdatedAt,
}: {
  open: boolean;
  onClose: () => void;
  industryId: string;
  month: number;
  year: number;
  current: number | null;
  expectedUpdatedAt: string | null;
}) {
  const invalidate = useInvalidate();
  const setFn = useServerFn(mk9SetIndustryContractTotal);
  const [total, setTotal] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTotal(current != null ? String(current) : "");
      setNotes("");
    }
  }, [open, current]);

  const mut = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          industryId,
          competenceMonth: month,
          competenceYear: year,
          contractedTotal: Number(total.replace(",", ".")),
          notes: notes.trim() || null,
          expectedUpdatedAt,
        },
      }),
    onSuccess: () => {
      toast.success("Total contratado registrado. Versão anterior preservada.");
      invalidate();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível salvar o total contratado.")),
  });

  const valid = Number.isFinite(Number(total.replace(",", "."))) && total.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Total contratado da indústria</DialogTitle>
          <DialogDescription>
            {MONTHS[month - 1]}/{year} — referência comercial. Não substitui a frequência por loja.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ct-total">Total contratado (visitas) *</Label>
            <Input id="ct-total" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="544" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-notes">Observação</Label>
            <Textarea id="ct-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valid || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Aceitar divergência
// ---------------------------------------------------------------------------
function AcceptDivergenceDialog({
  open,
  onClose,
  industryId,
  month,
  year,
  contractedTotal,
  distributedTotal,
}: {
  open: boolean;
  onClose: () => void;
  industryId: string;
  month: number;
  year: number;
  contractedTotal: number;
  distributedTotal: number;
}) {
  const acceptFn = useServerFn(mk9AcceptContractDivergence);
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);

  const mut = useMutation({
    mutationFn: () =>
      acceptFn({
        data: {
          industryId,
          competenceMonth: month,
          competenceYear: year,
          contractedTotal,
          distributedTotal,
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Diferença aceita e registrada no log de auditoria.");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível registrar a aceitação.")),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aceitar diferença</DialogTitle>
          <DialogDescription>
            Contrato {contractedTotal} × distribuição {distributedTotal}. Nada é corrigido automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="ad-reason">Justificativa *</Label>
          <Textarea id="ad-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={reason.trim().length < 3 || mut.isPending} onClick={() => mut.mutate()}>
            Registrar aceitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Aplicação em lote
// ---------------------------------------------------------------------------
function BulkFrequencyDialog({
  open,
  onClose,
  industryId,
  month,
  year,
}: {
  open: boolean;
  onClose: () => void;
  industryId: string;
  month: number;
  year: number;
}) {
  const invalidate = useInvalidate();
  const previewFn = useServerFn(mk9BulkFrequencyPreview);
  const applyFn = useServerFn(mk9BulkFrequencyApply);

  const [scope, setScope] = useState<"ALL_LINKED" | "WITHOUT_FREQUENCY" | "SEARCH" | "SELECTED">("ALL_LINKED");
  const [uf, setUf] = useState("");
  const [chain, setChain] = useState("");
  const [search, setSearch] = useState("");
  const [weekly, setWeekly] = useState("");
  const [monthly, setMonthly] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [mode, setMode] = useState<BulkApplyMode>("ONLY_WITHOUT");
  const [reason, setReason] = useState("");
  const [forceManual, setForceManual] = useState(false);
  const [forceFuture, setForceFuture] = useState(false);
  const [confirmRetroactive, setConfirmRetroactive] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setReason("");
    setForceManual(false);
    setForceFuture(false);
    setConfirmRetroactive(false);
  }, [open]);

  const basePayload = () => ({
    industryId,
    selection: {
      scope,
      uf: uf.trim() ? uf.trim().toUpperCase() : null,
      chain: chain.trim() || null,
      search: search.trim() || null,
      storeIds: [],
    },
    weeklyFrequency: parseFreq(weekly),
    monthlyFrequency: parseFreq(monthly),
    effectiveDate,
    mode,
    competenceMonth: month,
    competenceYear: year,
  });

  const previewMut = useMutation({
    mutationFn: () => previewFn({ data: basePayload() as any }),
    onSuccess: (res) => setPreview(res),
    onError: (e) => toast.error(errorMessage(e, "Não foi possível calcular a prévia.")),
  });

  const applyMut = useMutation({
    mutationFn: () =>
      applyFn({
        data: {
          ...basePayload(),
          reason: reason.trim(),
          confirmRetroactive,
          forceManualConflicts: forceManual,
          forceFutureConflicts: forceFuture,
        } as any,
      }),
    onSuccess: (res: any) => {
      if (res?.status === "needs_retroactive_confirmation") {
        toast.warning(res.warning);
        return;
      }
      if (res?.status === "nothing_to_do") {
        toast.info("Nenhuma loja precisou ser alterada.");
        return;
      }
      toast.success(`${res.applied} loja(s) atualizada(s). Histórico preservado.`);
      invalidate();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível aplicar as frequências em lote.")),
  });

  const c = preview?.counters;
  const canApply = !!preview && (c?.writable ?? 0) > 0 && reason.trim().length >= 3 && !applyMut.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Aplicar frequência em lote</DialogTitle>
          <DialogDescription>
            A seleção é reconstruída no servidor. Nada é salvo antes da confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-4 overflow-auto pr-1">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Lojas afetadas</Label>
              <Select value={scope} onValueChange={(v) => { setScope(v as any); setPreview(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_LINKED">Todas as lojas vinculadas</SelectItem>
                  <SelectItem value="WITHOUT_FREQUENCY">Somente lojas sem frequência</SelectItem>
                  <SelectItem value="SEARCH">Resultado da busca / filtros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modo de aplicação</Label>
              <Select value={mode} onValueChange={(v) => { setMode(v as BulkApplyMode); setPreview(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(BULK_MODE_LABEL) as BulkApplyMode[]).map((m) => (
                    <SelectItem key={m} value={m}>{BULK_MODE_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-uf">UF</Label>
              <Input id="bulk-uf" value={uf} maxLength={2} onChange={(e) => { setUf(e.target.value); setPreview(null); }} placeholder="Todas" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-chain">Rede</Label>
              <Input id="bulk-chain" value={chain} onChange={(e) => { setChain(e.target.value); setPreview(null); }} placeholder="Todas" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="bulk-search">Busca por nome da loja</Label>
              <Input id="bulk-search" value={search} onChange={(e) => { setSearch(e.target.value); setPreview(null); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-weekly">Frequência semanal</Label>
              <Input id="bulk-weekly" value={weekly} onChange={(e) => { setWeekly(e.target.value); setPreview(null); }} placeholder="1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-monthly">Frequência mensal</Label>
              <Input id="bulk-monthly" value={monthly} onChange={(e) => { setMonthly(e.target.value); setPreview(null); }} placeholder="4" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-date">Data de início *</Label>
              <Input id="bulk-date" type="date" value={effectiveDate} onChange={(e) => { setEffectiveDate(e.target.value); setPreview(null); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-reason">Justificativa *</Label>
              <Input id="bulk-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {describeFrequency(parseFreq(weekly), parseFreq(monthly))}
          </p>

          <Button
            variant="outline"
            disabled={previewMut.isPending || (parseFreq(weekly) === null && parseFreq(monthly) === null)}
            onClick={() => previewMut.mutate()}
          >
            {previewMut.isPending ? "Calculando…" : "Calcular prévia"}
          </Button>

          {preview && c && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Metric label="Selecionadas" value={c.selected} />
                <Metric label="Sem alteração" value={c.unchanged + c.skipped} />
                <Metric label="Novas" value={c.new} />
                <Metric label="Alteradas" value={c.changed} />
                <Metric label="Conflitos manuais" value={c.manualConflicts} />
                <Metric label="Conflitos futuros" value={c.futureConflicts} />
                <Metric label="Distribuído antes" value={preview.distributedBefore.distributedTotal} />
                <Metric label="Distribuído depois" value={preview.distributedAfter.distributedTotal} />
              </div>

              <p className="text-sm text-muted-foreground">
                Diferença para o contrato depois da aplicação:{" "}
                <strong>
                  {preview.distributedAfter.difference === null
                    ? "sem total informado"
                    : preview.distributedAfter.difference}
                </strong>
              </p>

              {c.manualConflicts > 0 && (
                <label className="flex items-center gap-2 text-xs text-amber-700">
                  <input type="checkbox" checked={forceManual} onChange={(e) => { setForceManual(e.target.checked); setPreview(null); }} />
                  Sobrescrever {c.manualConflicts} frequência(s) definida(s) manualmente.
                </label>
              )}
              {c.futureConflicts > 0 && (
                <label className="flex items-center gap-2 text-xs text-amber-700">
                  <input type="checkbox" checked={forceFuture} onChange={(e) => { setForceFuture(e.target.checked); setPreview(null); }} />
                  Sobrescrever {c.futureConflicts} loja(s) com vigência futura.
                </label>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={confirmRetroactive} onChange={(e) => setConfirmRetroactive(e.target.checked)} />
                Confirmo eventual alteração retroativa (competência encerrada).
              </label>

              <div className="max-h-[26vh] overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-left uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Loja</th>
                      <th className="p-2">UF</th>
                      <th className="p-2">Atual</th>
                      <th className="p-2">Nova</th>
                      <th className="p-2">Classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((i: any) => (
                      <tr key={i.storeId} className="border-t">
                        <td className="p-2">{i.storeName ?? "—"}</td>
                        <td className="p-2">{i.uf ?? "—"}</td>
                        <td className="p-2">
                          {i.current ? describeFrequency(i.current.weeklyFrequency, i.current.monthlyFrequency) : "—"}
                        </td>
                        <td className="p-2">{describeFrequency(i.incomingWeekly, i.incomingMonthly)}</td>
                        <td className="p-2">
                          <Badge variant={i.kind.includes("CONFLICT") ? "destructive" : "secondary"}>
                            {BULK_KIND_LABEL[i.kind as keyof typeof BULK_KIND_LABEL]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.truncated && (
                <p className="text-xs text-muted-foreground">Exibindo as 300 primeiras lojas da prévia.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!canApply} onClick={() => applyMut.mutate()}>
            Aplicar {c ? `${c.writable} loja(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
