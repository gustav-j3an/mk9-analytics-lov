/**
 * MK9 — Painel administrativo de frequências contratadas por indústria.
 *
 * A interface nunca decide sozinha: sobreposição, concorrência, retroatividade
 * e permissão são revalidadas no servidor/RPC. Aqui apenas coletamos dados e
 * exibimos o retorno.
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
import { Mk9StoreAutocomplete } from "@/components/mk9/store-autocomplete";
import { IndustryContractSummary } from "@/components/mk9/industry-contract-summary";
import {
  FREQUENCY_ADMIN_CACHE_KEYS,
  FREQUENCY_STATUS_LABEL,
  checkFrequencyCombination,
  frequencyVersionStatus,
  isRetroactiveChange,
} from "@/lib/mk9-frequency/admin";
import { describeFrequency } from "@/lib/mk9-frequency/canonical";
import {
  mk9CloseIndustryFrequency,
  mk9FrequencyCurrentVersion,
  mk9IndustryFrequencyHistory,
  mk9ListIndustryFrequencies,
  mk9SetIndustryFrequency,
} from "@/lib/mk9-frequency.functions";

const PAGE_SIZE = 20;
const todayIso = () => new Date().toISOString().slice(0, 10);

const SOURCE_LABEL: Record<string, string> = {
  IMPORT: "Importação",
  MANUAL: "Manual",
  MIGRATION: "Migração",
  SYSTEM: "Sistema",
};

function useInvalidateFrequencies() {
  const qc = useQueryClient();
  return () => {
    for (const key of FREQUENCY_ADMIN_CACHE_KEYS) qc.invalidateQueries({ queryKey: [key] });
  };
}

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

// ---------------------------------------------------------------------------
// Painel principal
// ---------------------------------------------------------------------------
export function IndustryFrequencyDialog({
  industry,
  onClose,
  isAdmin,
}: {
  industry: { id: string; name: string } | null;
  onClose: () => void;
  isAdmin: boolean;
}) {
  return (
    <Dialog open={!!industry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Frequências contratadas</DialogTitle>
          <DialogDescription>{industry?.name}</DialogDescription>
        </DialogHeader>
        {industry && <FrequencyPanel industryId={industry.id} isAdmin={isAdmin} />}
      </DialogContent>
    </Dialog>
  );
}

function FrequencyPanel({ industryId, isAdmin }: { industryId: string; isAdmin: boolean }) {
  const listFn = useServerFn(mk9ListIndustryFrequencies);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [uf, setUf] = useState("all");
  const [status, setStatus] = useState<"all" | "current" | "future" | "ended">("all");
  const [source, setSource] = useState<"all" | "IMPORT" | "MANUAL" | "MIGRATION" | "SYSTEM">("all");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [closing, setClosing] = useState<any | null>(null);
  const [history, setHistory] = useState<{ storeId: string; storeName: string | null } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced, uf, status, source]);

  const q = useQuery({
    queryKey: ["mk9-industry-frequencies", industryId, debounced, uf, status, source, page],
    queryFn: () =>
      listFn({
        data: {
          industryId,
          search: debounced || null,
          uf: uf === "all" ? null : uf,
          status,
          source,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const today = todayIso();
  const ufOptions = useMemo(
    () => Array.from(new Set(items.map((i: any) => i.uf).filter(Boolean))).sort(),
    [items],
  );

  return (
    <div className="space-y-4">
      <IndustryContractSummary industryId={industryId} isAdmin={isAdmin} />

      <div className="flex flex-wrap items-center gap-2">
        <p className="w-full text-sm font-semibold">Exceções por loja</p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar loja ou rede…"
          className="w-[240px]"
        />
        <Select value={uf} onValueChange={setUf}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas UFs</SelectItem>
            {ufOptions.map((u: any) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="current">Vigentes</SelectItem>
            <SelectItem value="future">Futuras</SelectItem>
            <SelectItem value="ended">Encerradas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => setSource(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="IMPORT">Importação</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
            <SelectItem value="MIGRATION">Migração</SelectItem>
            <SelectItem value="SYSTEM">Sistema</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {isAdmin && <Button onClick={() => setAddOpen(true)}>Adicionar frequência</Button>}
      </div>

      <div className="max-h-[52vh] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Loja</th>
              <th className="p-2">Rede</th>
              <th className="p-2">UF</th>
              <th className="p-2">Semanal</th>
              <th className="p-2">Mensal</th>
              <th className="p-2">Início</th>
              <th className="p-2">Fim</th>
              <th className="p-2">Status</th>
              <th className="p-2">Origem</th>
              <th className="p-2">Última alteração</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!q.isLoading && items.length === 0 && (
              <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">Nenhuma frequência encontrada.</td></tr>
            )}
            {items.map((r: any) => {
              const st = frequencyVersionStatus(r, today);
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-medium">{r.storeName ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{r.chain ?? "—"}</td>
                  <td className="p-2">{r.uf ?? "—"}</td>
                  <td className="p-2 tabular-nums">{r.weeklyFrequency ?? "—"}</td>
                  <td className="p-2 tabular-nums">{r.monthlyFrequency ?? "—"}</td>
                  <td className="p-2 tabular-nums">{r.validFrom}</td>
                  <td className="p-2 tabular-nums">{r.validUntil ?? "—"}</td>
                  <td className="p-2">
                    <Badge variant={st === "ended" ? "outline" : "secondary"}>
                      {FREQUENCY_STATUS_LABEL[st]}
                    </Badge>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{SOURCE_LABEL[r.sourceType] ?? r.sourceType}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {new Date(r.updatedAt).toLocaleString("pt-BR")}
                    {r.updatedBy && <span className="block">por {r.updatedBy.slice(0, 8)}…</span>}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setHistory({ storeId: r.storeId, storeName: r.storeName })}>
                        Histórico
                      </Button>
                      {isAdmin && st !== "ended" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Editar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setClosing(r)}>Encerrar</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} vigência(s)</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      {isAdmin && (
        <>
          <FrequencyFormDialog
            open={addOpen}
            onClose={() => setAddOpen(false)}
            industryId={industryId}
            mode="create"
          />
          <FrequencyFormDialog
            open={!!editing}
            onClose={() => setEditing(null)}
            industryId={industryId}
            mode="edit"
            row={editing}
          />
          <FrequencyCloseDialog row={closing} onClose={() => setClosing(null)} />
        </>
      )}
      <FrequencyHistoryDialog
        industryId={industryId}
        store={history}
        onClose={() => setHistory(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adicionar / Editar a partir de uma data
// ---------------------------------------------------------------------------
function FrequencyFormDialog({
  open,
  onClose,
  industryId,
  mode,
  row,
}: {
  open: boolean;
  onClose: () => void;
  industryId: string;
  mode: "create" | "edit";
  row?: any;
}) {
  const invalidate = useInvalidateFrequencies();
  const setFn = useServerFn(mk9SetIndustryFrequency);
  const currentFn = useServerFn(mk9FrequencyCurrentVersion);

  const [storeId, setStoreId] = useState("");
  const [weekly, setWeekly] = useState("");
  const [monthly, setMonthly] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [confirmInconsistent, setConfirmInconsistent] = useState(false);
  const [confirmRetroactive, setConfirmRetroactive] = useState(false);
  const [serverWarning, setServerWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStoreId(mode === "edit" ? (row?.storeId ?? "") : "");
    setWeekly(mode === "edit" && row?.weeklyFrequency != null ? String(row.weeklyFrequency) : "");
    setMonthly(mode === "edit" && row?.monthlyFrequency != null ? String(row.monthlyFrequency) : "");
    setEffectiveDate(todayIso());
    setReason("");
    setConfirmInconsistent(false);
    setConfirmRetroactive(false);
    setServerWarning(null);
  }, [open, mode, row]);

  const weeklyNum = parseFreq(weekly);
  const monthlyNum = parseFreq(monthly);
  const combination = checkFrequencyCombination(weeklyNum, monthlyNum, {
    confirmed: confirmInconsistent,
    reason,
  });
  const retroactive = isRetroactiveChange(effectiveDate, todayIso());

  const mut = useMutation({
    mutationFn: async () => {
      const current = storeId
        ? await currentFn({ data: { industryId, storeId, onDate: effectiveDate } })
        : null;
      return setFn({
        data: {
          industryId,
          storeId,
          weeklyFrequency: weeklyNum,
          monthlyFrequency: monthlyNum,
          effectiveDate,
          reason: reason.trim() || null,
          confirmInconsistent,
          confirmRetroactive,
          expectedUpdatedAt: (current as any)?.updatedAt ?? null,
        },
      });
    },
    onSuccess: (res: any) => {
      if (res?.status === "needs_confirmation" || res?.status === "needs_retroactive_confirmation") {
        setServerWarning(res.warning ?? "Confirmação necessária.");
        return;
      }
      toast.success(
        res?.retroactive
          ? "Frequência alterada retroativamente. Histórico preservado."
          : "Frequência registrada. Histórico preservado.",
      );
      invalidate();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível salvar a frequência.")),
  });

  const canSave =
    !!storeId &&
    (weeklyNum !== null || monthlyNum !== null) &&
    !mut.isPending &&
    (combination.ok || !combination.needsJustification || confirmInconsistent);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar a partir de uma data" : "Adicionar frequência"}
          </DialogTitle>
          <DialogDescription>
            A versão anterior é encerrada no dia anterior — nada é apagado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Loja *</Label>
            {mode === "edit" ? (
              <Input value={row?.storeName ?? ""} disabled />
            ) : (
              <Mk9StoreAutocomplete value={storeId} onChange={(s) => setStoreId(s.id)} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="freq-weekly">Frequência semanal</Label>
              <Input id="freq-weekly" value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder="0,5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="freq-monthly">Frequência mensal</Label>
              <Input id="freq-monthly" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="2" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{describeFrequency(weeklyNum, monthlyNum)}</p>
          <div className="space-y-1.5">
            <Label htmlFor="freq-date">Data de início *</Label>
            <Input id="freq-date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="freq-reason">Justificativa / observação</Label>
            <Textarea id="freq-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />
          </div>

          {combination.warning && (
            <div className="space-y-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
              <p>{combination.warning}</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmInconsistent}
                  onChange={(e) => setConfirmInconsistent(e.target.checked)}
                />
                Confirmo esta combinação excepcional (justificativa obrigatória).
              </label>
            </div>
          )}

          {retroactive && (
            <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p>A data pertence a uma competência encerrada — alteração retroativa.</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmRetroactive}
                  onChange={(e) => setConfirmRetroactive(e.target.checked)}
                />
                Confirmo a alteração retroativa (justificativa obrigatória).
              </label>
            </div>
          )}

          {serverWarning && <p className="text-sm text-destructive">{serverWarning}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!canSave} onClick={() => mut.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Encerrar
// ---------------------------------------------------------------------------
function FrequencyCloseDialog({ row, onClose }: { row: any | null; onClose: () => void }) {
  const invalidate = useInvalidateFrequencies();
  const closeFn = useServerFn(mk9CloseIndustryFrequency);
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (row) {
      setEndDate(todayIso());
      setReason("");
    }
  }, [row]);

  const mut = useMutation({
    mutationFn: () =>
      closeFn({
        data: {
          versionId: row.id,
          endDate,
          reason: reason.trim(),
          expectedUpdatedAt: row.updatedAt,
        },
      }),
    onSuccess: (res: any) => {
      if (res?.activeRoutes > 0) {
        toast.warning(
          `Frequência encerrada. Ainda existem ${res.activeRoutes} roteiro(s) vigente(s) para esta loja — revise em Roteiros.`,
        );
      } else {
        toast.success("Frequência encerrada. Histórico preservado.");
      }
      invalidate();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível encerrar a frequência.")),
  });

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar frequência</DialogTitle>
          <DialogDescription>{row?.storeName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="close-date">Data de encerramento *</Label>
            <Input id="close-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="close-reason">Justificativa *</Label>
            <Textarea id="close-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />
          </div>
          <p className="text-xs text-muted-foreground">
            A versão é preservada com data final — nada é excluído.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || mut.isPending}
            onClick={() => mut.mutate()}
          >
            Encerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------
function FrequencyHistoryDialog({
  industryId,
  store,
  onClose,
}: {
  industryId: string;
  store: { storeId: string; storeName: string | null } | null;
  onClose: () => void;
}) {
  const historyFn = useServerFn(mk9IndustryFrequencyHistory);
  const q = useQuery({
    queryKey: ["mk9-frequency-history", industryId, store?.storeId],
    queryFn: () => historyFn({ data: { industryId, storeId: store!.storeId } }),
    enabled: !!store,
  });

  return (
    <Dialog open={!!store} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de frequência</DialogTitle>
          <DialogDescription>{store?.storeName}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-auto">
          {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {(q.data ?? []).map((v: any) => (
            <div key={v.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{describeFrequency(v.weeklyFrequency, v.monthlyFrequency)}</span>
                <Badge variant="outline">{SOURCE_LABEL[v.sourceType] ?? v.sourceType}</Badge>
                {v.archivedAt && <Badge variant="outline">Substituída</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Vigência: {v.validFrom} → {v.validUntil ?? "em aberto"}
              </p>
              {v.sourceImportId && (
                <p className="text-xs text-muted-foreground">Importação: {v.sourceImportId.slice(0, 8)}…</p>
              )}
              {v.notes && <p className="mt-1 text-xs">Justificativa: {v.notes}</p>}
              <p className="text-xs text-muted-foreground">
                Alterado em {new Date(v.updatedAt).toLocaleString("pt-BR")}
                {v.updatedBy ? ` por ${v.updatedBy.slice(0, 8)}…` : ""}
              </p>
            </div>
          ))}
          {!q.isLoading && (q.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sem histórico para esta loja.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
