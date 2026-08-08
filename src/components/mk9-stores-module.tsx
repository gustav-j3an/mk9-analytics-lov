import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Store, 
  MapPin,
  Building2,
  Edit2,
  Archive,
  RefreshCcw,
} from "lucide-react";
import { StoreDialog, StoreArchiveDialog } from "./mk9/store-admin-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { mk9ListStores } from "@/lib/mk9-data.functions";
import { mk9ReactivateStore } from "@/lib/mk9-stores.functions";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { 
  Mk9PageHeader, 
  Mk9MetricCard, 
  Mk9Panel, 
  Mk9Badge 
} from "./mk9/design-system";


export function Mk9StoresModule() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  
  const queryClient = useQueryClient();
  const session = useMk9Session();
  const isAdmin = session.hasRole("ADMIN");

  const listFn = useServerFn(mk9ListStores);
  const reactivateFn = useServerFn(mk9ReactivateStore);

  const { data, isLoading } = useQuery({
    queryKey: ["mk9-stores"],
    queryFn: () => listFn(),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => reactivateFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Loja reativada.");
      queryClient.invalidateQueries({ queryKey: ["mk9-stores"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao reativar loja."),
  });

  const filtered = (data ?? []).filter((s: any) => {
    const isArchived = Boolean(s.archived_at);
    if (statusFilter === "active" && isArchived) return false;
    if (statusFilter === "archived" && !isArchived) return false;

    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.chain?.toLowerCase().includes(term) ?? false) ||
      (s.city?.toLowerCase().includes(term) ?? false) ||
      (s.uf?.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <Mk9PageHeader 
        title="Gestão de Lojas" 
        subtitle="Controle de pontos de venda e redes"
        icon={Store}
        actions={
          isAdmin && (
            <Button onClick={() => { setEditingStore(null); setDialogOpen(true); }} className="gap-2 bg-command-purple hover:bg-command-purple/90 text-white border-none shadow-lg shadow-purple-500/20">
              <Plus className="h-4 w-4" />
              Nova Loja
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Mk9MetricCard label="Total de lojas" value={data?.length ?? 0} color="blue" />
        <Mk9MetricCard label="Ativas" value={data?.filter(s => !s.archivedAt).length ?? 0} color="emerald" />
        <Mk9MetricCard label="UFs" value={new Set(data?.map(s => s.uf).filter(Boolean)).size} color="purple" />
        <Mk9MetricCard label="Redes" value={new Set(data?.map(s => s.chain).filter(Boolean)).size} color="amber" />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)} className="w-full md:w-auto">
              <TabsList className="bg-command-deep border border-white/5 p-1">
                <TabsTrigger value="active" className="data-[state=active]:bg-command-purple data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest">Ativas</TabsTrigger>
                <TabsTrigger value="archived" className="data-[state=active]:bg-command-purple data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest">Arquivadas</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Busca por nome, rede, cidade ou UF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-command-deep border-white/10 text-white"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 overflow-hidden">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="hover:bg-transparent border-white/5">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Loja</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rede / Canal</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Localização</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</TableHead>
                {isAdmin && <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-white/5">
                    <TableCell><Skeleton className="h-5 w-48 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 bg-white/5" /></TableCell>
                    {isAdmin && <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto bg-white/5" /></TableCell>}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="h-32 text-center text-slate-500 italic">
                    Nenhuma loja encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s: any) => (
                  <TableRow key={s.id} className="group transition-colors border-white/5 hover:bg-white/[0.02]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                          <Store className="h-4 w-4 text-indigo-400" />
                        </div>
                        <div>
                          <div className="font-bold text-white uppercase tracking-tight">{s.name}</div>
                          <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">ID: {s.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                          <Building2 className="h-3.5 w-3.5 text-slate-500" />
                          {s.chain || "Sem rede"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        {s.city || "—"}, {s.uf || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.archived_at ? (
                        <Mk9Badge variant="default">Arquivada</Mk9Badge>
                      ) : (
                        <Mk9Badge variant="success">Ativa</Mk9Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right flex items-center justify-end gap-1">
                        {!s.archived_at ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 text-slate-400 hover:text-white"
                              onClick={() => {
                                setEditingStore(s);
                                setDialogOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 text-rose-500"
                              onClick={() => {
                                setEditingStore(s);
                                setArchiveDialogOpen(true);
                              }}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-indigo-400 hover:bg-indigo-500/10"
                            title="Reativar"
                            onClick={() => reactivateMut.mutate(s.id)}
                            disabled={reactivateMut.isPending}
                          >
                            <RefreshCcw className={`h-4 w-4 ${reactivateMut.isPending ? "animate-spin" : ""}`} />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Mk9Panel>


      <StoreDialog 
        open={dialogOpen} 
        store={editingStore} 
        onClose={() => {
          setDialogOpen(false);
          setEditingStore(null);
        }} 
      />

      <StoreArchiveDialog
        open={archiveDialogOpen}
        store={editingStore}
        onClose={() => {
          setArchiveDialogOpen(false);
          setEditingStore(null);
        }}
      />
    </div>
  );
}
