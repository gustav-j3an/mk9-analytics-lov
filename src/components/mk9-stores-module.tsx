import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Store,
  Search,
  Plus,
  MoreVertical,
  MapPin,
  Edit2,
  Trash2,
  Building,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mk9ListStores } from "@/lib/mk9-data.functions";
import { StoreDialog, StoreArchiveDialog } from "@/components/mk9/store-admin-dialogs";
import {
  Mk9Panel,
  Mk9PageHeader,
  Mk9MetricCard,
  Mk9LoadingState,
  Mk9EmptyState,
  Mk9Badge,
} from "@/components/mk9/design-system";

export function Mk9StoresModule() {
  const listFn = useServerFn(mk9ListStores);
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["mk9-stores-admin"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingStore, setEditingStore] = useState<any | null>(null);
  const [archivingStore, setArchivingStore] = useState<any | null>(null);

  const filtered = useMemo(() => {
    return stores.filter(
      (s: any) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.chain && s.chain.toLowerCase().includes(search.toLowerCase())) ||
        (s.uf && s.uf.toLowerCase().includes(search.toLowerCase())),
    );
  }, [stores, search]);

  const stats = useMemo(() => {
    return {
      total: stores.length,
      active: stores.filter((s: any) => !s.archivedAt).length,
      ufs: new Set(stores.map((s: any) => s.uf).filter(Boolean)).size,
    };
  }, [stores]);

  if (isLoading) return <Mk9LoadingState message="Carregando lojas..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Mk9PageHeader
        title="Gestão de Lojas"
        subtitle="Controle de unidades operacionais e redes varejistas"
        icon={Store}
        actions={
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-white font-black uppercase tracking-widest px-6 shadow-lg shadow-mk9-accent-primary/20 border-none"
          >
            <Plus className="h-4 w-4 mr-2" /> Nova Loja
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Mk9MetricCard label="Total de Lojas" value={stats.total} icon={Store} color="blue" />
        <Mk9MetricCard label="Lojas Ativas" value={stats.active} icon={Building} color="emerald" />
        <Mk9MetricCard label="Estados (UF)" value={stats.ufs} icon={Navigation} color="purple" />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, rede ou UF..."
              className="pl-10 bg-white/[0.03] border-border text-white placeholder:text-slate-600 focus:ring-mk9-accent-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                <th className="px-4 py-4 text-left font-black">Unidade / Loja</th>
                <th className="px-4 py-4 text-left font-black">Rede / Bandeira</th>
                <th className="px-4 py-4 text-left font-black">Localização</th>
                <th className="px-4 py-4 text-left font-black">Status</th>
                <th className="px-4 py-4 text-right font-black">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <Mk9EmptyState message="Nenhuma loja encontrada." />
                  </td>
                </tr>
              ) : (
                filtered.map((s: any) => (
                  <tr key={s.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white group-hover:text-mk9-accent-primary transition-colors">
                          {s.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">
                          {s.id.split("-")[0]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-slate-300 font-medium uppercase tracking-tight">
                        {s.chain || "LOJA INDEPENDENTE"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <Mk9Badge className="bg-slate-500/10 text-muted-foreground border-none font-mono">
                          {s.uf || "??"}
                        </Mk9Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {s.archivedAt ? (
                        <Mk9Badge variant="danger">Arquivada</Mk9Badge>
                      ) : (
                        <Mk9Badge variant="success">Ativa</Mk9Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-white"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-command-deep border-border text-white"
                        >
                          <DropdownMenuItem
                            onClick={() => setEditingStore(s)}
                            className="gap-2 cursor-pointer hover:bg-white/5"
                          >
                            <Edit2 className="h-3.5 w-3.5" /> Editar
                          </DropdownMenuItem>
                          {!s.archivedAt && (
                            <DropdownMenuItem
                              onClick={() => setArchivingStore(s)}
                              className="gap-2 cursor-pointer text-rose-400 hover:bg-rose-400/10 focus:bg-rose-400/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Arquivar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Mk9Panel>

      <StoreDialog
        open={showCreate || !!editingStore}
        onClose={() => {
          setShowCreate(false);
          setEditingStore(null);
        }}
        store={editingStore}
      />

      <StoreArchiveDialog
        open={!!archivingStore}
        onClose={() => setArchivingStore(null)}
        store={archivingStore}
      />
    </div>
  );
}
