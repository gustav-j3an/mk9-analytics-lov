import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Edit2,
  Trash2,
  Plus,
  Search,
  Store,
  MapPin,
  Route as RouteIcon,
  Layout,
  Eye,
  ArrowRightLeft
} from "lucide-react";
import { Mk9PageHeader, Mk9Panel, Mk9LoadingState, Mk9EmptyState } from "./mk9/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from "@/components/ui/select";
import { toast } from "sonner";
import { mk9RoutesListVersioned, mk9RoutesDeleteItem } from "@/lib/mk9-routes.functions";
import { useNavigate } from "@tanstack/react-router";
import { RouteItemDialog } from "./mk9/route-item-dialog";
import {
  RouteDayEditorDialog,
  type DayEditorInitial,
} from "./mk9/route-day-editor-dialog";


interface Props {
  promoters: Array<{ id: string; name: string; supervisor_id?: string | null }>;
  stores: Array<{ id: string; name: string; chain: string | null; uf: string | null }>;
  industries: Array<{ id: string; name: string }>;
}

export function Mk9RoutesModule({ promoters, stores, industries }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterUf, setFilterUf] = useState<string>("all");
  const [filterIndustry, setFilterIndustry] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [dayEditor, setDayEditor] = useState<DayEditorInitial | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const referenceDate = new Date().toISOString().slice(0, 10);


  const listRoutesFn = useServerFn(mk9RoutesListVersioned);
  const deleteRouteFn = useServerFn(mk9RoutesDeleteItem);

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["mk9-planned-routes-list", referenceDate],
    queryFn: () => listRoutesFn({ data: { referenceDate, includeInactive: false } }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRouteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Vínculo de roteiro excluído.");
      qc.invalidateQueries({ queryKey: ["mk9-planned-routes-list"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir."),
  });

  // Agrupamento: Promotor -> Dia -> Loja -> Indústrias
  const groupedData = useMemo(() => {
    const filtered = routes.filter((r: any) => {
      const matchesSearch = r.promoterName.toLowerCase().includes(search.toLowerCase()) || 
                           r.storeName.toLowerCase().includes(search.toLowerCase());
      const matchesUf = filterUf === "all" || r.storeUf === filterUf;
      const matchesInd = filterIndustry === "all" || r.industryId === filterIndustry;
      return matchesSearch && matchesUf && matchesInd;
    });

    const map = new Map();

    filtered.forEach((r: any) => {
      if (!map.has(r.promoterId)) {
        const promoter = promoters.find(p => p.id === r.promoterId);
        map.set(r.promoterId, {
          id: r.promoterId,
          name: r.promoterName,
          supervisor: promoter?.supervisor_id || "Sem Supervisor",
          uf: r.storeUf,
          days: new Map()
        });
      }
      const p = map.get(r.promoterId);
      if (!p.days.has(r.weekday)) {
        p.days.set(r.weekday, new Map());
      }
      const d = p.days.get(r.weekday);
      if (!d.has(r.storeId)) {
        d.set(r.storeId, {
          id: r.storeId,
          name: r.storeName,
          chain: r.storeChain,
          uf: r.storeUf,
          industries: []
        });
      }

      d.get(r.storeId).industries.push({
        id: r.id,
        industryId: r.industryId,
        name: r.industryName,
        validFrom: r.validFrom
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [routes, search, filterUf, filterIndustry, promoters]);

  const ufs = useMemo(() => {
    return Array.from(new Set(stores.map(s => s.uf).filter(Boolean))).sort();
  }, [stores]);

  // Editor por dia: sempre montado a partir da base COMPLETA (sem filtros de tela),
  // para que salvar um dia nunca remova vínculos apenas ocultos pelo filtro.
  const openDayEditor = (promoterId: string, weekday: number) => {
    const dayRows = routes.filter(
      (r: any) => r.promoterId === promoterId && r.weekday === weekday,
    );
    const byStore = new Map<string, any>();
    dayRows.forEach((r: any) => {
      if (!byStore.has(r.storeId)) {
        byStore.set(r.storeId, {
          storeId: r.storeId,
          storeName: r.storeName,
          storeUf: r.storeUf,
          industryIds: [],
        });
      }
      byStore.get(r.storeId).industryIds.push(r.industryId);
    });
    setDayEditor({
      promoterId,
      promoterName: promoters.find((p) => p.id === promoterId)?.name,
      weekdays: [weekday],
      stores: Array.from(byStore.values()),
    });
  };


  const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

  if (isLoading) return <Mk9LoadingState message="Carregando roteiros..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Mk9PageHeader
        title="Roteiros"
        subtitle="Gestão da Rota-Base e Planejamento Semanal"
        icon={RouteIcon}
        actions={
          <div className="flex items-center gap-3">
             <Button
              variant="outline"
              className="h-9 border-border text-muted-foreground hover:text-foreground hover:bg-accent text-[10px] font-black uppercase tracking-widest"
              onClick={() => {}} // TODO: Implementar Transferência
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" /> Transferência
            </Button>
            <Button
              onClick={() => setShowCreate(true)}
              className="h-9 bg-primary hover:bg-primary/90 text-foreground font-black uppercase tracking-widest px-6 shadow-lg shadow-primary/20 border-none"
            >
              <Plus className="h-4 w-4 mr-2" /> Novo Item de Roteiro
            </Button>

          </div>
        }
      />

      <Mk9Panel>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar promotor ou loja..."
              className="pl-10 bg-muted/30 border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={filterIndustry} onValueChange={setFilterIndustry}>
            <SelectTrigger className="bg-muted/30 border-border">
              <SelectValue placeholder="Todas as Indústrias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Indústrias</SelectItem>
              {industries.map(i => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterUf} onValueChange={setFilterUf}>
            <SelectTrigger className="bg-muted/30 border-border">
              <SelectValue placeholder="Todas as UFs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as UFs</SelectItem>
              {ufs.map(uf => (
                <SelectItem key={uf} value={uf || "—"}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-6">
          {groupedData.length === 0 ? (
            <Mk9EmptyState message="Nenhum roteiro encontrado para os filtros aplicados." />
          ) : (
            groupedData.map((promoter: any) => (
              <div key={promoter.id} className="border border-border/50 rounded-2xl overflow-hidden bg-white/[0.01]">
                <div className="bg-muted/20 p-4 flex items-center justify-between border-b border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Layout className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground uppercase tracking-tight">{promoter.name}</h3>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" /> {promoter.uf || "—"}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                           {promoter.supervisor}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/10"
                    onClick={() => navigate({ to: `/roteiros/promotor/${promoter.id}` })}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> Ver Rota Individual
                  </Button>
                </div>

                <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from(promoter.days.entries()).sort((a: any, b: any) => a[0] - b[0]).map(([day, storesMap]: any) => (
                    <div key={day} className="bg-muted/10 rounded-xl p-3 border border-border/30 space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <CalendarDays className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80 truncate">
                            {WEEKDAYS[day]}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openDayEditor(promoter.id, day)}
                          className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline shrink-0"
                        >
                          Editar Dia
                        </button>
                      </div>

                      <div className="space-y-3">
                        {Array.from(storesMap.values()).map((store: any) => (
                          <div key={store.id} className="space-y-1">
                            <div className="flex items-center gap-1.5 px-1">
                              <Store className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] font-black text-foreground uppercase tracking-tight truncate">
                                {store.name}
                              </span>
                            </div>
                            <div className="pl-3 space-y-0.5 border-l border-border/30 ml-2 mt-1">
                              {store.industries.map((ind: any) => (
                                <div key={ind.id} className="flex items-center justify-between group py-0.5 px-2 rounded hover:bg-accent/50 transition-colors">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                    {ind.name}
                                  </span>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
                                      onClick={() => setEditingItem({
                                        id: ind.id,
                                        promoterId: promoter.id,
                                        industryId: ind.industryId,
                                        industryName: ind.name,
                                        storeId: store.id,
                                        storeName: store.name,
                                        weekday: day,
                                        validFrom: ind.validFrom
                                      })}
                                    >
                                      <Edit2 className="h-2.5 w-2.5" />
                                    </button>
                                    <button 
                                      className="h-4 w-4 text-muted-foreground hover:text-rose-500 transition-colors flex items-center justify-center"
                                      onClick={() => {
                                        if (window.confirm(`Excluir vínculo da indústria ${ind.name} nesta loja?`)) {
                                          deleteMut.mutate(ind.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => openDayEditor(promoter.id, day)}
                          className="w-full mt-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary border border-dashed border-border/50 rounded-lg py-1.5 transition-colors"
                        >
                          + Adicionar loja neste dia
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Mk9Panel>

      <RouteItemDialog 
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        promoters={promoters}
        industries={industries}
        item={editingItem}
      />

      <RouteDayEditorDialog
        open={showCreate || !!dayEditor}
        onClose={() => {
          setShowCreate(false);
          setDayEditor(null);
        }}
        mode={dayEditor ? "day" : "new"}
        promoters={promoters}
        industries={industries}
        initial={dayEditor}
      />

    </div>

  );
}
