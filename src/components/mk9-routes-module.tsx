// Mk9RoutesModule — visualização e edição do Roteiro versionado.
// Agrupa Promotor → Dia da semana → Loja → Indústrias. Toda alteração
// abre um modal que exige a data de vigência escolhida pelo usuário
// (nunca "hoje" automaticamente). Conflitos de sobreposição retornam
// a rota conflitante e bloqueiam o salvamento até correção.

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
  History,
  Loader2,
  Pencil,
  Plus,
  PowerOff,
  Route as RouteIcon,
  Users,
  FileText,
  Info,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Mk9PageHeader, Mk9Panel, Mk9MetricCard } from "./mk9/design-system";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  mk9RoutesListVersioned,
  mk9RoutesListHistory,
  mk9RoutesUpsertItem,
  mk9RoutesDeactivate,
  mk9RoutesDeleteItem,
} from "@/lib/mk9-routes.functions";
import { mk9PromoterRouteStats } from "@/lib/mk9-promoter-route.functions";
import { Mk9StoreAutocomplete } from "@/components/mk9/store-autocomplete";

const WEEKDAY_PT = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];


type Route = Awaited<ReturnType<typeof mk9RoutesListVersioned>>[number];

interface Props {
  promoters: Array<{ id: string; name: string }>;
  stores: Array<{ id: string; name: string; chain: string | null; uf: string | null }>;
  industries: Array<{ id: string; name: string }>;
}

interface ConflictPayload {
  conflictRouteId: string;
  conflictPromoterId: string;
  conflictPromoterName: string;
  conflictFrom: string;
  conflictUntil: string;
}

export function Mk9RoutesModule({ promoters, stores, industries }: Props) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [referenceDate, setReferenceDate] = useState(today);
  const [filterPromoter, setFilterPromoter] = useState<string>("");
  const [filterIndustry, setFilterIndustry] = useState<string>("");
  const [filterStore, setFilterStore] = useState<string>("");
  const [filterUf, setFilterUf] = useState<string>("");
  const [filterWeekday, setFilterWeekday] = useState<string>("");
  const [nameFilter, setNameFilter] = useState("");

  const [editing, setEditing] = useState<Route | null>(null);
  const [deleting, setDeleting] = useState<Route | null>(null);
  const [creating, setCreating] = useState(false);
  const [historyKey, setHistoryKey] = useState<{
    storeId: string;
    industryId: string;
    weekday: number;
    label: string;
  } | null>(null);

  const listFn = useServerFn(mk9RoutesListVersioned);
  const listQ = useQuery({
    queryKey: [
      "mk9-routes-versioned",
      referenceDate,
      filterPromoter,
      filterIndustry,
      filterStore,
      filterUf,
      filterWeekday,
    ],
    queryFn: () =>
      listFn({
        data: {
          referenceDate,
          promoterId: filterPromoter || undefined,
          industryId: filterIndustry || undefined,
          storeId: filterStore || undefined,
          uf: (filterUf || undefined) as string | undefined,
          weekday: filterWeekday === "" ? undefined : Number(filterWeekday),
        },
      }),
  });

  const rawRoutes = listQ.data ?? [];
  const routes = useMemo(() => {
    if (!nameFilter.trim()) return rawRoutes;
    const q = nameFilter.toLowerCase();
    return rawRoutes.filter(
      (r) =>
        r.promoterName.toLowerCase().includes(q) ||
        r.storeName.toLowerCase().includes(q) ||
        r.industryName.toLowerCase().includes(q),
    );
  }, [rawRoutes, nameFilter]);

  const grouped = useMemo(() => {
    // Promotor → weekday → storeId → { store, items[] }
    const m = new Map<string, Map<number, Map<string, { store: Route; items: Route[] }>>>();
    for (const r of routes) {
      if (!m.has(r.promoterName)) m.set(r.promoterName, new Map());
      const days = m.get(r.promoterName)!;
      if (!days.has(r.weekday)) days.set(r.weekday, new Map());
      const stMap = days.get(r.weekday)!;
      const key = (r.storeId ?? r.storeName) as string;
      if (!stMap.has(key)) stMap.set(key, { store: r, items: [] });
      stMap.get(key)!.items.push(r);
    }
    return m;
  }, [routes]);

  const ufs = Array.from(new Set(stores.map((s) => s.uf).filter(Boolean))) as string[];

  return (
    <div className="space-y-6">
      <Mk9PageHeader
        title="Gestão de Roteiros"
        subtitle="Controle de vigência e periodicidade semanal"
        icon={RouteIcon}
        actions={
          <Button
            onClick={() => setCreating(true)}
            className="h-9 bg-command-purple hover:bg-command-purple/80 text-white border-none shadow-[0_0_15px_rgba(168,85,247,0.3)] uppercase text-[10px] font-black tracking-widest px-6"
          >
            <Plus className="h-4 w-4 mr-2" /> Novo Item
          </Button>
        }
      />

      <Mk9Panel className="relative">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CalendarClock className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Filtros Operacionais
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Referência
            </label>
            <Input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="h-9 bg-black/40 border-white/5 text-xs text-white"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Promotor
            </label>
            <Select
              value={filterPromoter || "all"}
              onValueChange={(v) => setFilterPromoter(v === "all" ? "" : v)}
            >
              <SelectTrigger className="h-9 bg-black/40 border-white/5 text-xs text-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="all">Todos</SelectItem>
                {promoters.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Indústria
            </label>
            <Select
              value={filterIndustry || "all"}
              onValueChange={(v) => setFilterIndustry(v === "all" ? "" : v)}
            >
              <SelectTrigger className="h-9 bg-black/40 border-white/5 text-xs text-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="all">Todas</SelectItem>
                {industries.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              UF
            </label>
            <Select
              value={filterUf || "all"}
              onValueChange={(v) => setFilterUf(v === "all" ? "" : v)}
            >
              <SelectTrigger className="h-9 bg-black/40 border-white/5 text-xs text-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="all">Todas</SelectItem>
                {ufs.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-4 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Busca Rápida
            </label>
            <Input
              placeholder="Buscar por promotor, loja ou indústria…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="h-9 bg-black/40 border-white/5 text-xs text-white"
            />
          </div>
          <Button
            variant="outline"
            className="h-9 border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest"
            onClick={() => qc.invalidateQueries({ queryKey: ["mk9-routes-versioned"] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </Mk9Panel>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Roteiros vigentes em <strong>{referenceDate}</strong> · {routes.length} itens
        </p>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="h-9 bg-command-purple hover:bg-command-purple/80 text-white border-none uppercase text-[10px] font-black tracking-widest px-6"
          >
            <Plus className="h-4 w-4 mr-2" /> Novo item de roteiro
          </Button>
        </div>
      </div>

      {listQ.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : routes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum roteiro vigente para os filtros escolhidos.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filterPromoter && (
            <PromoterRouteCard
              promoterId={filterPromoter}
              referenceDate={referenceDate}
              promoters={promoters}
            />
          )}
          {Array.from(grouped.keys())
            .sort((a, b) => a.localeCompare(b, "pt-BR"))
            .map((promoter) => {
              const days = grouped.get(promoter)!;
              return (
                <Card key={promoter}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {promoter}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.from(days.keys())
                      .sort()
                      .map((wd) => {
                        const stMap = days.get(wd)!;
                        return (
                          <div key={wd} className="rounded-lg border bg-muted/20 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                                {WEEKDAY_PT[wd]}
                              </p>
                              {filterPromoter && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 bg-background font-normal"
                                >
                                  {Array.from(stMap.values()).length} visitas
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-2">
                              {Array.from(stMap.values()).map(({ store, items }) => (
                                <div
                                  key={store.storeId ?? store.storeName}
                                  className="flex items-start justify-between gap-3 border-l-2 border-primary/40 pl-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                      {store.storeChain ? `${store.storeChain} · ` : ""}
                                      {store.storeName}
                                      {store.storeUf ? (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          {store.storeUf}
                                        </span>
                                      ) : null}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                      {items.map((it) => (
                                        <div
                                          key={it.id}
                                          className="inline-flex items-center gap-1 rounded-md bg-background border px-1.5 py-0.5 text-xs"
                                        >
                                          <span>{it.industryName}</span>
                                          <div className="flex items-center gap-0.5 ml-1 border-l pl-1 border-white/10">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 text-slate-400 hover:text-white"
                                              title="Editar item"
                                              onClick={() => setEditing(it)}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 text-slate-400 hover:text-destructive"
                                              title="Excluir rota"
                                              onClick={() => setDeleting(it)}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 text-slate-400 hover:text-primary"
                                              title="Histórico de versões"
                                              onClick={() =>
                                                setHistoryKey({
                                                  storeId: it.storeId!,
                                                  industryId: it.industryId!,
                                                  weekday: it.weekday,
                                                  label: `${it.storeName} · ${it.industryName} · ${WEEKDAY_PT[it.weekday]}`,
                                                })
                                              }
                                            >
                                              <History className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {(editing || creating) && (
        <EditDialog
          initial={editing}
          promoters={promoters}
          stores={stores}
          industries={industries}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["mk9-routes-versioned"] });
          }}
        />
      )}

      {historyKey && (
        <HistoryDialog
          storeId={historyKey.storeId}
          industryId={historyKey.industryId}
          weekday={historyKey.weekday}
          label={historyKey.label}
          onClose={() => setHistoryKey(null)}
        />
      )}
      {deleting && (
        <DeleteConfirmDialog
          item={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            qc.invalidateQueries({ queryKey: ["mk9-routes-versioned"] });
            qc.invalidateQueries({ queryKey: ["mk9-promoter-route-stats"] });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de confirmação de exclusão
// ---------------------------------------------------------------------------
function DeleteConfirmDialog({
  item,
  onClose,
  onDeleted,
}: {
  item: Route;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const deleteFn = useServerFn(mk9RoutesDeleteItem);
  const mutation = useMutation({
    mutationFn: () => deleteFn({ data: { id: item.id } }),
    onSuccess: () => {
      toast.success("Item removido do roteiro.");
      onDeleted();
    },
    onError: (err: any) => toast.error(err.message || "Falha ao excluir."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> Excluir item do roteiro?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2 text-xs text-slate-400 bg-white/5 p-4 rounded-lg border border-white/10">
            <div className="flex justify-between">
              <span className="uppercase font-bold tracking-widest text-[9px]">Promotor:</span>
              <span className="text-white font-medium">{item.promoterName}</span>
            </div>
            <div className="flex justify-between">
              <span className="uppercase font-bold tracking-widest text-[9px]">Loja:</span>
              <span className="text-white font-medium">{item.storeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="uppercase font-bold tracking-widest text-[9px]">Indústria:</span>
              <span className="text-white font-medium">{item.industryName}</span>
            </div>
            <div className="flex justify-between">
              <span className="uppercase font-bold tracking-widest text-[9px]">Dia:</span>
              <span className="text-white font-medium">{WEEKDAY_PT[item.weekday]}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 italic">
            "Esta ação removerá apenas este atendimento do roteiro planejado. Visitas realizadas e históricos permanecem intactos."
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="font-black uppercase text-[10px] tracking-widest"
          >
            {mutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-3 w-3 mr-2" />
            )}
            Excluir Rota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Modal de criação/edição
// ---------------------------------------------------------------------------
function EditDialog({
  initial,
  promoters,
  stores,
  industries,
  onClose,
  onSaved,
}: {
  initial: Route | null;
  promoters: Array<{ id: string; name: string }>;
  stores: Array<{ id: string; name: string; chain: string | null; uf: string | null }>;
  industries: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [promoterId, setPromoterId] = useState(initial?.promoterId ?? "");
  const [storeId, setStoreId] = useState(initial?.storeId ?? "");
  const [industryId, setIndustryId] = useState(initial?.industryId ?? "");
  const [weekday, setWeekday] = useState<number>(initial?.weekday ?? 1);
  const [validFrom, setValidFrom] = useState<string>(""); // obrigatório escolha explícita
  const [conflict, setConflict] = useState<ConflictPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upsertFn = useServerFn(mk9RoutesUpsertItem);
  const deactivateFn = useServerFn(mk9RoutesDeactivate);

  const save = useMutation({
    mutationFn: async () => {
      setError(null);
      setConflict(null);
      if (!promoterId || !storeId || !industryId)
        throw new Error("Preencha promotor, loja e indústria.");
      if (!validFrom) throw new Error("Escolha a data de início da nova vigência.");
      return upsertFn({
        data: {
          id: initial?.id,
          promoterId,
          storeId,
          industryId,
          weekday,
          validFrom,
        },
      });
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => {
      const msg = err?.message || "Falha ao salvar.";
      if (msg.startsWith("CONFLITO_VIGENCIA::")) {
        try {
          setConflict(JSON.parse(msg.slice("CONFLITO_VIGENCIA::".length)));
        } catch {
          setError(msg);
        }
      } else {
        setError(msg);
      }
    },
  });

  const deactivate = useMutation({
    mutationFn: async () => {
      if (!initial?.id || !validFrom) throw new Error("Escolha a data-limite de encerramento.");
      return deactivateFn({ data: { id: initial.id, validUntil: validFrom } });
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => setError(err?.message || "Falha ao desativar."),
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RouteIcon className="h-4 w-4" />{" "}
            {initial ? "Editar item de roteiro" : "Novo item de roteiro"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Promotor</label>
            <Select value={promoterId} onValueChange={setPromoterId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {promoters.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Loja</label>
            <Mk9StoreAutocomplete
              value={storeId}
              initialLabel={
                initial?.storeName
                  ? `${initial.storeName}${initial.storeUf ? ` · ${initial.storeUf}` : ""}`
                  : null
              }
              onChange={(s) => setStoreId(s.id)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Indústria</label>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Dia da semana</label>
              <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_PT.map((n, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> Vigência a partir de
              </label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
          </div>
          {initial && (
            <p className="text-xs text-muted-foreground">
              Versão atual vigente desde <strong>{initial.validFrom}</strong>. A nova vigência
              precisa ser posterior.
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Não foi possível salvar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {conflict && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Conflito de vigência</AlertTitle>
              <AlertDescription className="space-y-1">
                <p>
                  Esta loja + indústria + dia já está atribuída a{" "}
                  <strong>{conflict.conflictPromoterName}</strong> no intervalo{" "}
                  <strong>{conflict.conflictFrom}</strong> →{" "}
                  <strong>{conflict.conflictUntil}</strong>.
                </p>
                <p>Encerre ou reagende a rota conflitante antes de salvar.</p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {initial && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => deactivate.mutate()}
              disabled={!validFrom || deactivate.isPending}
            >
              <PowerOff className="h-4 w-4" /> Desativar em {validFrom || "…"}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar nova vigência
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Histórico de versões
// ---------------------------------------------------------------------------
function HistoryDialog({
  storeId,
  industryId,
  weekday,
  label,
  onClose,
}: {
  storeId: string;
  industryId: string;
  weekday: number;
  label: string;
  onClose: () => void;
}) {
  const listFn = useServerFn(mk9RoutesListHistory);
  const q = useQuery({
    queryKey: ["mk9-routes-history", storeId, industryId, weekday],
    queryFn: () => listFn({ data: { storeId, industryId, weekday } }),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico · {label}
          </DialogTitle>
        </DialogHeader>
        {q.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {(q.data ?? []).map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded border p-2 text-sm"
              >
                <div>
                  <p className="font-medium">{v.promoterName}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.validFrom} → {v.validUntil ?? "vigente"}
                  </p>
                </div>
                <div className="flex gap-1">
                  {v.isActive ? (
                    <Badge variant="default">Ativa</Badge>
                  ) : (
                    <Badge variant="outline">Encerrada</Badge>
                  )}
                  {v.archivedAt && <Badge variant="destructive">Arquivada</Badge>}
                </div>
              </div>
            ))}
            {(q.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Card de Resumo do Roteiro (Missão: Total de Visitas)
// ---------------------------------------------------------------------------
function PromoterRouteCard({
  promoterId,
  referenceDate,
  promoters,
}: {
  promoterId: string;
  referenceDate: string;
  promoters: any[];
}) {
  const [y, m] = referenceDate.split("-").map(Number);
  const promoter = promoters.find((p) => p.id === promoterId);

  const statsFn = useServerFn(mk9PromoterRouteStats);
  const q = useQuery({
    queryKey: ["mk9-promoter-route-stats", promoterId, y, m],
    queryFn: () => statsFn({ data: { promoterId, year: y, month: m } }),
  });

  const months = [
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

  return (
    <Card className="bg-primary/5 border-primary/20 shadow-none overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <RouteIcon className="h-24 w-24 text-primary" />
      </div>
      <CardContent className="pt-6">
        {q.isLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando resumo...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            <div className="space-y-1 border-r pr-6 border-primary/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Promotor
              </p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold truncate">{promoter?.name ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-background/50">
                  {months[m - 1]}/{y}
                </Badge>
              </div>
            </div>
            <div className="space-y-1 border-r pr-6 border-primary/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Total de Visitas
              </p>
              <p className="text-2xl font-black text-primary">{q.data?.totalVisits ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Contratadas no período</p>
            </div>
            <div className="space-y-1 border-r pr-6 border-primary/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Lojas Únicas
              </p>
              <p className="text-2xl font-black">{q.data?.uniqueStores ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Pontos de venda</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Indústrias
              </p>
              <p className="text-2xl font-black">{q.data?.uniqueIndustries ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Marcas atendidas</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
