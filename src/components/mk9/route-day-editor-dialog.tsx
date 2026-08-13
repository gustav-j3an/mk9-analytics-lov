// Editor de Roteiro por DIA (Missão 8A.3).
// Dois fluxos, mesmo componente:
//   mode="day"  → EDITAR DIA: substitui o estado daquele weekday (diff),
//                 sem tocar nos demais dias.
//   mode="new"  → NOVO ROTEIRO: aplica lojas/indústrias em vários dias
//                 em modo aditivo (merge), sem remover nada existente.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Calendar, Loader2, Plus, Search, Store as StoreIcon, Trash2 } from "lucide-react";
import { mk9RoutesSaveDay } from "@/lib/mk9-routes.functions";
import { Mk9StoreAutocomplete } from "./store-autocomplete";
import { Mk9PromoterCombobox } from "./promoter-combobox";

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const WEEKDAY_SHORT = [
  { id: 1, label: "SEG" },
  { id: 2, label: "TER" },
  { id: 3, label: "QUA" },
  { id: 4, label: "QUI" },
  { id: 5, label: "SEX" },
  { id: 6, label: "SAB" },
  { id: 0, label: "DOM" },
];

export interface DayEditorStore {
  storeId: string;
  storeName: string;
  storeUf?: string | null;
  industryIds: string[];
}

export interface DayEditorInitial {
  promoterId: string;
  promoterName?: string;
  weekdays: number[];
  stores: DayEditorStore[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "day" | "new";
  promoters: Array<{ id: string; name: string }>;
  industries: Array<{ id: string; name: string }>;
  initial?: DayEditorInitial | null;
}

export function RouteDayEditorDialog({
  open,
  onClose,
  mode,
  promoters,
  industries,
  initial,
}: Props) {
  const qc = useQueryClient();
  const saveDayFn = useServerFn(mk9RoutesSaveDay);

  const [promoterId, setPromoterId] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [rows, setRows] = useState<DayEditorStore[]>([]);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [industrySearch, setIndustrySearch] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setPromoterId(initial?.promoterId ?? "");
    setWeekdays(initial?.weekdays ?? []);
    setRows(initial?.stores ? initial.stores.map((s) => ({ ...s })) : []);
    setValidFrom(new Date().toISOString().slice(0, 10));
    setAdding(mode === "new" || !(initial?.stores?.length));
    setIndustrySearch({});
  }, [open, initial, mode]);

  const sortedIndustries = useMemo(
    () => [...industries].sort((a, b) => a.name.localeCompare(b.name)),
    [industries],
  );

  const totalVisits = rows.reduce((acc, r) => acc + r.industryIds.length, 0);
  const dayTitle =
    mode === "day" && weekdays.length === 1
      ? `Editar ${WEEKDAY_LABELS[weekdays[0]].toUpperCase()}`
      : "Novo Roteiro";

  const mut = useMutation({
    mutationFn: async () => {
      const payloadStores = rows
        .filter((r) => r.industryIds.length > 0)
        .map((r) => ({ storeId: r.storeId, industryIds: r.industryIds }));
      let created = 0;
      let removed = 0;
      let conflicts = 0;
      for (const wd of weekdays) {
        const res = await saveDayFn({
          data: {
            promoterId,
            weekday: wd,
            validFrom,
            mode: mode === "day" ? ("replace" as const) : ("merge" as const),
            stores: payloadStores,
          },
        });
        created += res.created;
        removed += res.removed;
        conflicts += res.conflicts;
      }
      return { created, removed, conflicts };
    },
    onSuccess: (res) => {
      const parts = [`${res.created} vínculo(s) criado(s)`];
      if (res.removed) parts.push(`${res.removed} encerrado(s)`);
      if (res.conflicts) parts.push(`${res.conflicts} em conflito de vigência`);
      toast.success(parts.join(" · "));
      qc.invalidateQueries({ queryKey: ["mk9-planned-routes-list"] });
      qc.invalidateQueries({ queryKey: ["mk9-promoter-route"] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar o dia."),
  });

  const toggleIndustry = (storeId: string, industryId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.storeId !== storeId
          ? r
          : {
              ...r,
              industryIds: r.industryIds.includes(industryId)
                ? r.industryIds.filter((i) => i !== industryId)
                : [...r.industryIds, industryId],
            },
      ),
    );
  };

  const canSave =
    !!promoterId && weekdays.length > 0 && rows.some((r) => r.industryIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-mk9-accent-primary uppercase">
            {dayTitle}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {mode === "day"
              ? "Gerencie todas as lojas e indústrias deste dia"
              : "Construtor de roteiro — dias, lojas e indústrias"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Promotor *
              </Label>
              <Mk9PromoterCombobox
                value={promoterId}
                onChange={setPromoterId}
                promoters={promoters}
                disabled={mode === "day"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Início da Vigência *
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="h-9 pl-10 bg-input/50 border-border"
                />
              </div>
            </div>
          </div>

          {mode === "new" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Dias da Semana *
              </Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {WEEKDAY_SHORT.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() =>
                      setWeekdays((prev) =>
                        prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                      )
                    }
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all",
                      weekdays.includes(d.id)
                        ? "bg-primary/10 border-primary/30"
                        : "bg-muted/30 border-border/50 hover:border-border",
                    )}
                  >
                    <Checkbox checked={weekdays.includes(d.id)} className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-black select-none">{d.label}</span>
                  </button>
                ))}
              </div>
              {weekdays.length > 0 && (
                <p className="text-[9px] font-black uppercase text-primary/80 pt-1 ml-1">
                  Este roteiro será aplicado em{" "}
                  {weekdays
                    .slice()
                    .sort()
                    .map((w) => WEEKDAY_SHORT.find((d) => d.id === w)?.label)
                    .join(", ")}
                  .
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Lojas do dia
              </Label>
              <span className="text-[9px] font-black text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full">
                {rows.length} loja(s) · {totalVisits} visita(s)
              </span>
            </div>

            {rows.map((row) => {
              const q = (industrySearch[row.storeId] ?? "").toLowerCase();
              const list = sortedIndustries.filter((i) => i.name.toLowerCase().includes(q));
              return (
                <div
                  key={row.storeId}
                  className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase truncate flex items-center gap-1.5">
                        <StoreIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {row.storeName}
                      </p>
                      {row.storeUf && (
                        <p className="text-[9px] font-bold text-muted-foreground uppercase ml-5">
                          {row.storeUf}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-rose-500 transition-colors shrink-0"
                      onClick={() =>
                        setRows((prev) => prev.filter((r) => r.storeId !== row.storeId))
                      }
                      aria-label="Remover loja"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="border border-border/50 rounded-lg overflow-hidden bg-background/30">
                    <div className="p-1.5 border-b border-border/50 flex items-center gap-2 bg-muted/20">
                      <Search className="h-3 w-3 text-muted-foreground" />
                      <input
                        placeholder="Buscar indústria…"
                        value={industrySearch[row.storeId] ?? ""}
                        onChange={(e) =>
                          setIndustrySearch((prev) => ({
                            ...prev,
                            [row.storeId]: e.target.value,
                          }))
                        }
                        className="bg-transparent border-none outline-none text-[11px] flex-1 placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div
                      className="overflow-y-auto overscroll-contain p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1"
                      style={{ maxHeight: 140 }}
                    >
                      {list.map((ind) => {
                        const checked = row.industryIds.includes(ind.id);
                        return (
                          <button
                            type="button"
                            key={ind.id}
                            onClick={() => toggleIndustry(row.storeId, ind.id)}
                            className={cn(
                              "flex items-center gap-2 p-1.5 rounded-md transition-colors text-left border",
                              checked
                                ? "bg-primary/10 border-primary/20"
                                : "hover:bg-accent border-transparent",
                            )}
                          >
                            <Checkbox checked={checked} className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold uppercase truncate">
                              {ind.name}
                            </span>
                          </button>
                        );
                      })}
                      {list.length === 0 && (
                        <p className="col-span-2 text-[10px] text-center py-3 text-muted-foreground">
                          Nenhuma indústria encontrada.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {adding ? (
              <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Pesquisar loja por nome, rede, cidade ou UF
                </Label>
                <Mk9StoreAutocomplete
                  key={addKey}
                  value=""
                  onChange={(s) => {
                    if (rows.some((r) => r.storeId === s.id)) {
                      toast.info("Esta loja já está adicionada.");
                      return;
                    }
                    setRows((prev) => [
                      ...prev,
                      {
                        storeId: s.id,
                        storeName: s.name,
                        storeUf: s.uf ?? null,
                        industryIds: [],
                      },
                    ]);
                    setAddKey((k) => k + 1);
                    setAdding(false);
                  }}
                />
                <Button
                  variant="ghost"
                  className="h-7 text-[10px] font-black text-muted-foreground"
                  onClick={() => setAdding(false)}
                >
                  CANCELAR
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-9 border-dashed text-[10px] font-black uppercase tracking-widest"
                onClick={() => setAdding(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-2" /> Adicionar Loja
              </Button>
            )}
          </div>

          <p className="text-[9px] text-muted-foreground uppercase font-black text-center italic bg-muted/10 py-1 rounded">
            {mode === "day"
              ? "Vínculos removidos terão a vigência encerrada em " +
                new Date(new Date(validFrom).getTime() - 86400000).toLocaleDateString("pt-BR") +
                ". Os demais dias não são afetados."
              : "Novos vínculos serão criados a partir de " +
                new Date(validFrom + "T00:00:00").toLocaleDateString("pt-BR") +
                "."}
          </p>
        </div>

        <DialogFooter className="mt-2 border-t border-border/50 pt-4">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground text-[10px] font-black"
            onClick={onClose}
          >
            CANCELAR
          </Button>
          <Button
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-foreground font-black px-8"
            onClick={() => mut.mutate()}
            disabled={!canSave || mut.isPending}
          >
            {mut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : mode === "day" && weekdays.length === 1 ? (
              `SALVAR ${WEEKDAY_LABELS[weekdays[0]].toUpperCase()}`
            ) : (
              "SALVAR ROTEIRO"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
