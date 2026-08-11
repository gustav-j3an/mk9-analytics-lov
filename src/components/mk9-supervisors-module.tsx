import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  ShieldCheck,
  UserCheck,
  Archive,
  ChevronRight,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  listSupervisors,
  createSupervisor,
  updateSupervisor,
  archiveSupervisor,
  getSupervisorDetails,
  assignPromotersToSupervisor
} from "@/lib/mk9-supervisors.functions";
import { mk9ListPromoters } from "@/lib/mk9-data.functions";
import {
  Mk9Panel,
  Mk9PageHeader,
  Mk9MetricCard,
  Mk9LoadingState,
  Mk9EmptyState,
  Mk9Badge,
} from "@/components/mk9/design-system";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function Mk9SupervisorsModule() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listSupervisors);
  const getDetailsFn = useServerFn(getSupervisorDetails);
  
  const { data: supervisors = [], isLoading } = useQuery({
    queryKey: ["mk9-supervisors"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState<any | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return supervisors.filter((s: any) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [supervisors, search]);

  if (isLoading) return <Mk9LoadingState message="Carregando supervisores..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Mk9PageHeader
        title="Gestão de Supervisores"
        subtitle="Controle central de liderança de campo"
        icon={UserCheck}
        actions={
          <Button
            onClick={() => {
              setEditingSupervisor(null);
              setIsDialogOpen(true);
            }}
            className="bg-command-purple hover:bg-command-purple/90 text-white font-black uppercase tracking-widest px-6 shadow-lg shadow-command-purple/20 border-none"
          >
            <Plus className="h-4 w-4 mr-2" /> Novo Supervisor
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Mk9MetricCard label="Total de Supervisores" value={supervisors.length} icon={UserCheck} color="purple" />
        <Mk9MetricCard label="Equipes Ativas" value={supervisors.filter((s: any) => s.active).length} icon={ShieldCheck} color="emerald" />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar supervisor..."
              className="pl-10 bg-white/[0.03] border-border text-white placeholder:text-slate-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                <th className="px-4 py-4 text-left font-black">Nome</th>
                <th className="px-4 py-4 text-left font-black">Status</th>
                <th className="px-4 py-4 text-right font-black">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    <Mk9EmptyState message="Nenhum supervisor encontrado." />
                  </td>
                </tr>
              ) : (
                filtered.map((s: any) => (
                  <tr key={s.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-4">
                      <button 
                        onClick={() => setDetailId(s.id)}
                        className="text-sm font-bold text-white group-hover:text-command-purple transition-colors flex items-center gap-2"
                      >
                        {s.name}
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      {s.active ? (
                        <Mk9Badge variant="success">Ativo</Mk9Badge>
                      ) : (
                        <Mk9Badge variant="danger">Inativo</Mk9Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-command-deep border-border text-white">
                          <DropdownMenuItem onClick={() => setDetailId(s.id)} className="gap-2 cursor-pointer">
                            <Users className="h-3.5 w-3.5" /> Ver Equipe
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditingSupervisor(s);
                            setIsDialogOpen(true);
                          }} className="gap-2 cursor-pointer">
                            <Edit2 className="h-3.5 w-3.5" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={async () => {
                            if (confirm(`Deseja arquivar o supervisor ${s.name}?`)) {
                              await queryClient.fetchQuery({ 
                                queryKey: ['archive-supervisor', s.id], 
                                queryFn: () => queryClient.ensureQueryData({
                                  queryKey: ['archive-op', s.id],
                                  queryFn: () => archiveSupervisor({ data: s.id })
                                })
                              });
                              toast.success("Supervisor arquivado");
                              queryClient.invalidateQueries({ queryKey: ["mk9-supervisors"] });
                            }
                          }} className="gap-2 cursor-pointer text-rose-400">
                            <Archive className="h-3.5 w-3.5" /> Arquivar
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

      <SupervisorFormDialog 
        open={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        supervisor={editingSupervisor} 
      />

      <SupervisorDetailsSheet 
        id={detailId} 
        onClose={() => setDetailId(null)} 
      />
    </div>
  );
}

function SupervisorFormDialog({ open, onClose, supervisor }: { open: boolean, onClose: () => void, supervisor: any }) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createSupervisor);
  const updateFn = useServerFn(updateSupervisor);
  const [name, setName] = useState("");

  useMemo(() => {
    setName(supervisor?.name || "");
  }, [supervisor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (supervisor) {
        await updateFn({ data: { id: supervisor.id, name } });
        toast.success("Supervisor atualizado");
      } else {
        await createFn({ data: { name } });
        toast.success("Supervisor criado");
      }
      queryClient.invalidateQueries({ queryKey: ["mk9-supervisors"] });
      onClose();
    } catch (err) {
      toast.error("Erro ao salvar supervisor");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-command-deep border-border text-white">
        <DialogHeader>
          <DialogTitle>{supervisor ? "Editar Supervisor" : "Novo Supervisor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Digite o nome..."
              required
              className="bg-white/[0.03] border-border"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-command-purple hover:bg-command-purple/90">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SupervisorDetailsSheet({ id, onClose }: { id: string | null, onClose: () => void }) {
  const queryClient = useQueryClient();
  const getDetailsFn = useServerFn(getSupervisorDetails);
  const assignFn = useServerFn(assignPromotersToSupervisor);
  const listPromotersFn = useServerFn(mk9ListPromoters);

  const { data: details, isLoading } = useQuery({
    queryKey: ["mk9-supervisor-details", id],
    queryFn: () => getDetailsFn({ data: id! }),
    enabled: !!id,
  });

  const { data: allPromoters = [] } = useQuery({
    queryKey: ["mk9-promoters-admin"],
    queryFn: () => listPromotersFn(),
    enabled: !!id,
  });

  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedPromoters, setSelectedPromoters] = useState<string[]>([]);

  const handleAssign = async () => {
    if (!id) return;
    try {
      await assignFn({ data: { supervisorId: id, promoterIds: selectedPromoters } });
      toast.success("Equipe atualizada");
      queryClient.invalidateQueries({ queryKey: ["mk9-supervisor-details", id] });
      setIsAssigning(false);
      setSelectedPromoters([]);
    } catch (err) {
      toast.error("Erro ao vincular promotores");
    }
  };

  return (
    <Sheet open={!!id} onOpenChange={onClose}>
      <SheetContent className="bg-command-deep border-border text-white sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-white flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-command-purple" />
            {details?.name || "Carregando..."}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><Mk9LoadingState /></div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Membros da Equipe ({details?.members?.length || 0})</h3>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-[10px] border-border"
                onClick={() => setIsAssigning(!isAssigning)}
              >
                {isAssigning ? "Cancelar" : <><UserPlus className="h-3 w-3 mr-1" /> Gerenciar</>}
              </Button>
            </div>

            {isAssigning ? (
              <div className="space-y-4">
                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {allPromoters.filter((p: any) => p.isActive).map((p: any) => (
                    <div key={p.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <Checkbox 
                        id={p.id} 
                        checked={selectedPromoters.includes(p.id) || (details?.members?.some((m: any) => m.id === p.id) && !selectedPromoters.includes(p.id))}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedPromoters([...selectedPromoters, p.id]);
                          else setSelectedPromoters(selectedPromoters.filter(sid => sid !== p.id));
                        }}
                      />
                      <label htmlFor={p.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1">
                        {p.name}
                        <span className="block text-[10px] text-muted-foreground">{p.employeeNumber} | {p.uf}</span>
                      </label>
                    </div>
                  ))}
                </div>
                <Button onClick={handleAssign} className="w-full bg-command-purple hover:bg-command-purple/90">Confirmar Vínculos</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {details?.members?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum promotor vinculado.</p>
                ) : (
                  details?.members?.map((m: any) => (
                    <div key={m.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{m.employee_number} • {m.uf}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
                        onClick={async () => {
                          if (confirm(`Remover ${m.name} da equipe?`)) {
                             await assignFn({ data: { supervisorId: null, promoterIds: [m.id] } });
                             toast.success("Promotor removido da equipe");
                             queryClient.invalidateQueries({ queryKey: ["mk9-supervisor-details", id] });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
