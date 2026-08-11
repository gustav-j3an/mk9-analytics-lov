import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Factory,
  Search,
  Plus,
  MoreVertical,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  ShieldCheck,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";
import {
  IndustryCreateDialog,
  IndustryEditDialog,
  IndustryArchiveDialog,
  IndustryReactivateDialog,
} from "@/components/mk9/industry-admin-dialogs";
import {
  Mk9Panel,
  Mk9PageHeader,
  Mk9MetricCard,
  Mk9LoadingState,
  Mk9EmptyState,
  Mk9Badge,
} from "@/components/mk9/design-system";

export function Mk9IndustriesModule() {
  const listFn = useServerFn(mk9ListIndustries);
  const { data: industries = [], isLoading } = useQuery({
    queryKey: ["mk9-industries-admin"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<any | null>(null);
  const [archivingIndustry, setArchivingIndustry] = useState<any | null>(null);
  const [reactivatingIndustry, setReactivatingIndustry] = useState<any | null>(null);

  const filtered = useMemo(() => {
    return industries.filter(
      (i: any) =>
        i.name.toLowerCase().includes(search.toLowerCase()) || (i.cnpj && i.cnpj.includes(search)),
    );
  }, [industries, search]);

  const stats = useMemo(() => {
    return {
      total: industries.length,
      active: industries.filter((i: any) => !i.archivedAt).length,
      withChecklist: industries.filter((i: any) => i.requiresChecklist).length,
    };
  }, [industries]);

  if (isLoading) return <Mk9LoadingState message="Carregando indústrias..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Mk9PageHeader
        title="Gestão de Indústrias"
        subtitle="Controle central de clientes e parceiros operacionais"
        icon={Factory}
        actions={
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-foreground font-black uppercase tracking-widest px-6 shadow-lg shadow-mk9-accent-primary/20 border-none"
          >
            <Plus className="h-4 w-4 mr-2" /> Nova Indústria
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Mk9MetricCard
          label="Total de Clientes"
          value={stats.total}
          icon={Factory}
          color="purple"
        />
        <Mk9MetricCard
          label="Operação Ativa"
          value={stats.active}
          icon={ShieldCheck}
          color="emerald"
        />
        <Mk9MetricCard
          label="Exigem Checklist"
          value={stats.withChecklist}
          icon={Building}
          color="blue"
        />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 focus:ring-mk9-accent-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                <th className="px-4 py-4 text-left font-black">Indústria</th>
                <th className="px-4 py-4 text-left font-black">CNPJ</th>
                <th className="px-4 py-4 text-left font-black">Configurações</th>
                <th className="px-4 py-4 text-left font-black">Status</th>
                <th className="px-4 py-4 text-right font-black">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <Mk9EmptyState message="Nenhuma indústria encontrada para esta busca." />
                  </td>
                </tr>
              ) : (
                filtered.map((i: any) => (
                  <tr key={i.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground group-hover:text-mk9-accent-primary transition-colors">
                          {i.name}
                        </span>
                        {i.displayName && (
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            {i.displayName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-mono text-muted-foreground">{i.cnpj || "—"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {i.requiresChecklist && (
                          <Mk9Badge variant="info" className="flex items-center gap-1">
                            <CheckCircle className="h-2 w-2" /> Checklist
                          </Mk9Badge>
                        )}
                        {i.controlMode === "FIXED_OPERATION" ? (
                          <Mk9Badge variant="warning" className="flex items-center gap-1">
                            <Clock className="h-2 w-2" /> Fixa
                          </Mk9Badge>
                        ) : (
                          <Mk9Badge variant="success" className="flex items-center gap-1">
                            <ShieldCheck className="h-2 w-2" /> Monitorada
                          </Mk9Badge>
                        )}
                        <Mk9Badge className="flex items-center gap-1">
                          <Clock className="h-2 w-2" />{" "}
                          {i.periodType === "CUSTOM_CYCLE" ? "Ciclo" : "Mensal"}
                        </Mk9Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {i.archivedAt ? (
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
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-popover border-border text-foreground"
                        >
                          <DropdownMenuItem
                            onClick={() => setEditingIndustry(i)}
                            className="gap-2 cursor-pointer hover:bg-accent"
                          >
                            <Edit2 className="h-3.5 w-3.5" /> Editar
                          </DropdownMenuItem>
                          {i.archivedAt ? (
                            <DropdownMenuItem
                              onClick={() => setReactivatingIndustry(i)}
                              className="gap-2 cursor-pointer text-emerald-400 hover:bg-emerald-400/10 focus:bg-emerald-400/10"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" /> Reativar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setArchivingIndustry(i)}
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

      <IndustryCreateDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <IndustryEditDialog industry={editingIndustry} onClose={() => setEditingIndustry(null)} />
      <IndustryArchiveDialog
        industry={archivingIndustry}
        onClose={() => setArchivingIndustry(null)}
      />
      <IndustryReactivateDialog
        industry={reactivatingIndustry}
        onClose={() => setReactivatingIndustry(null)}
      />
    </div>
  );
}
