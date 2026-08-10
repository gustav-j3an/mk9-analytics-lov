import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  ShieldAlert,
  MapPin,
  IdCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mk9ListPromoters } from "@/lib/mk9-data.functions";
import { PromoterDialog, PromoterDeleteDialog } from "@/components/mk9/promoter-admin-dialogs";
import {
  Mk9Panel,
  Mk9PageHeader,
  Mk9MetricCard,
  Mk9LoadingState,
  Mk9EmptyState,
  Mk9Badge,
} from "@/components/mk9/design-system";

export function Mk9PromotersModule() {
  const listFn = useServerFn(mk9ListPromoters);
  const { data: promoters = [], isLoading, refetch } = useQuery({
    queryKey: ["mk9-promoters-admin"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingPromoter, setEditingPromoter] = useState<any | null>(null);
  const [deletingPromoter, setDeletingPromoter] = useState<any | null>(null);

  const filtered = useMemo(() => {
    return promoters.filter(
      (p: any) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.employeeNumber && p.employeeNumber.includes(search)) ||
        (p.uf && p.uf.toLowerCase().includes(search.toLowerCase())),
    );
  }, [promoters, search]);

  const stats = useMemo(() => {
    return {
      total: promoters.length,
      active: promoters.filter((p: any) => p.isActive).length,
      ufs: new Set(promoters.map((p: any) => p.uf).filter(Boolean)).size,
    };
  }, [promoters]);

  if (isLoading) return <Mk9LoadingState message="Carregando promotores..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Mk9PageHeader
        title="Gestão de Promotores"
        subtitle="Agentes de campo e execução operacional"
        icon={Users}
        actions={
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-white font-black uppercase tracking-widest px-6 shadow-lg shadow-mk9-accent-primary/20 border-none"
          >
            <Plus className="h-4 w-4 mr-2" /> Novo Promotor
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Mk9MetricCard label="Total de Agentes" value={stats.total} icon={Users} color="orange" />
        <Mk9MetricCard label="Em Atividade" value={stats.active} icon={IdCard} color="emerald" />
        <Mk9MetricCard label="Abrangência (UF)" value={stats.ufs} icon={MapPin} color="purple" />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Buscar por nome, matrícula ou UF..."
              className="pl-10 bg-white/[0.03] border-white/10 text-white placeholder:text-slate-600 focus:ring-mk9-accent-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                <th className="px-4 py-4 text-left font-black">Promotor</th>
                <th className="px-4 py-4 text-left font-black">Matrícula</th>
                <th className="px-4 py-4 text-left font-black">Localização</th>
                <th className="px-4 py-4 text-left font-black">Status</th>
                <th className="px-4 py-4 text-right font-black">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <Mk9EmptyState message="Nenhum promotor encontrado." />
                  </td>
                </tr>
              ) : (
                filtered.map((p: any) => (
                  <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white group-hover:text-mk9-accent-primary transition-colors">
                          {p.name}
                        </span>
                        {p.contact && (
                          <span className="text-[10px] text-slate-500 uppercase tracking-tight">
                            {p.contact}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-mono text-slate-300">
                        {p.employeeNumber || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        <span className="text-xs font-medium text-slate-300">
                          {p.city} / {p.uf}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {p.isActive ? (
                        <Mk9Badge variant="success">Ativo</Mk9Badge>
                      ) : (
                        <Mk9Badge variant="danger">Inativo</Mk9Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-command-deep border-white/10 text-white"
                        >
                          <DropdownMenuItem
                            onClick={() => setEditingPromoter(p)}
                            className="gap-2 cursor-pointer hover:bg-white/5"
                          >
                            <Edit2 className="h-3.5 w-3.5" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingPromoter(p)}
                            className="gap-2 cursor-pointer text-rose-400 hover:bg-rose-400/10 focus:bg-rose-400/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </DropdownMenuItem>
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

      <PromoterDialog
        open={showCreate || !!editingPromoter}
        onClose={() => {
          setShowCreate(false);
          setEditingPromoter(null);
        }}
        promoter={editingPromoter}
      />

      <PromoterDeleteDialog
        open={!!deletingPromoter}
        onClose={() => {
          if (deletingPromoter?.wasDeleted) {
            refetch();
          }
          setDeletingPromoter(null);
        }}
        onSuccess={() => {
          setDeletingPromoter(prev => ({ ...prev, wasDeleted: true }));
        }}
        promoter={deletingPromoter}
      />
    </div>
  );
}
