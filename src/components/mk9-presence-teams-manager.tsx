import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Users, 
  Save, 
  X, 
  Settings, 
  Search, 
  UserPlus, 
  UserMinus,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  listPresenceTeams, 
  createPresenceTeam, 
  updatePresenceTeam, 
  archivePresenceTeam,
  listSupervisors,
  getPresenceTeamDetails,
  addPromotersToTeam,
  removePromoterFromTeam,
  listPotentialMembers
} from "@/lib/mk9-presence-teams.functions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PresenceTeamsManager() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listPresenceTeams);
  const createFn = useServerFn(createPresenceTeam);
  const updateFn = useServerFn(updatePresenceTeam);
  const archiveFn = useServerFn(archivePresenceTeam);
  const supervisorsFn = useServerFn(listSupervisors);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [teamName, setTeamName] = useState("");
  const [supervisorId, setSupervisorId] = useState<string | null>(null);

  const { data: teams } = useQuery({ queryKey: ["mk9-presence-teams-list"], queryFn: () => listFn() });
  const { data: supervisors } = useQuery({ queryKey: ["mk9-supervisors-list"], queryFn: () => supervisorsFn() });

  const mutation = useMutation({
    mutationFn: async () => {
      console.log("[PRESENCE-TEAM] Payload:", { teamName, supervisorId });
      if (editingTeam) return updateFn({ data: { id: editingTeam.id, name: teamName, supervisorId } });
      return createFn({ data: { name: teamName, supervisorId } });
    },
    onSuccess: () => {
      toast.success(editingTeam ? "Equipe atualizada." : "Equipe criada.");
      queryClient.invalidateQueries({ queryKey: ["mk9-presence-teams-list"] });
      resetAndClose();
    },
    onError: (err: any) => {
      console.error("[PRESENCE-TEAM] Error detail:", err);
      toast.error(`Erro ao salvar equipe: ${err.message || "Tente novamente."}`);
    }
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveFn({ data: id }),
    onSuccess: () => {
      toast.success("Equipe arquivada.");
      queryClient.invalidateQueries({ queryKey: ["mk9-presence-teams-list"] });
    }
  });

  const resetAndClose = () => {
    setTeamName("");
    setSupervisorId(null);
    setEditingTeam(null);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black uppercase tracking-widest text-white">Configurar Equipes</h2>
        <Button onClick={() => setIsDialogOpen(true)} size="sm" className="bg-command-purple">
          <Plus className="w-4 h-4 mr-2" /> NOVA EQUIPE
        </Button>
      </div>

      <div className="grid gap-3">
        {teams?.map(team => (
          <div key={team.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:bg-white/[0.04] transition-all">
            <div>
              <p className="text-sm font-bold text-white">{team.name}</p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-[10px] uppercase text-slate-500">Supervisor: {team.supervisor?.name || "Não definido"}</p>
                <div className="w-1 h-1 rounded-full bg-slate-700" />
                <p className="text-[10px] uppercase text-command-purple font-bold">18 promotores</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-command-purple hover:text-purple-400"
                onClick={() => { setSelectedTeam(team); setIsManageOpen(true); }}
              >
                <Users className="w-4 h-4 mr-1" />
                <span className="text-[10px] font-bold">GERENCIAR</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditingTeam(team); setTeamName(team.name); setSupervisorId(team.supervisor_id); setIsDialogOpen(true); }}>
                <Edit2 className="w-4 h-4 text-slate-400" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => archiveMutation.mutate(team.id)}>
                <Trash2 className="w-4 h-4 text-rose-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Manage Members Sheet/Dialog */}
      {selectedTeam && (
        <TeamMemberManager 
          teamId={selectedTeam.id} 
          open={isManageOpen} 
          onClose={() => {
            setIsManageOpen(false);
            setSelectedTeam(null);
            queryClient.invalidateQueries({ queryKey: ["mk9-presence-teams-list"] });
          }} 
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-command-deep border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Editar Equipe" : "Nova Equipe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Nome da equipe" />
            <Select value={supervisorId || "NONE"} onValueChange={v => setSupervisorId(v === "NONE" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar supervisor" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep">
                <SelectItem value="NONE">Sem supervisor</SelectItem>
                {supervisors?.map(s => <SelectItem key={s.id} value={s.id}>{s.name || s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetAndClose}>Cancelar</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamMemberManager({ teamId, open, onClose }: { teamId: string, open: boolean, onClose: () => void }) {
  const queryClient = useQueryClient();
  const getDetailsFn = useServerFn(getPresenceTeamDetails);
  const listPotentialFn = useServerFn(listPotentialMembers);
  const addFn = useServerFn(addPromotersToTeam);
  const removeFn = useServerFn(removePromoterFromTeam);

  const [search, setSearch] = useState("");
  const [selectedPromoterIds, setSelectedPromoterIds] = useState<string[]>([]);
  const [movingPromoter, setMovingPromoter] = useState<any>(null);

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ["mk9-presence-team-details", teamId],
    queryFn: () => getDetailsFn({ data: teamId }),
    enabled: open
  });

  const { data: potentialMembers, isLoading: potentialLoading } = useQuery({
    queryKey: ["mk9-potential-members"],
    queryFn: () => listPotentialFn(),
    enabled: open
  });

  const addMutation = useMutation({
    mutationFn: (ids: string[]) => addFn({ data: { teamId, promoterIds: ids } }),
    onSuccess: () => {
      toast.success("Promotores adicionados à equipe.");
      setSelectedPromoterIds([]);
      queryClient.invalidateQueries({ queryKey: ["mk9-presence-team-details", teamId] });
      queryClient.invalidateQueries({ queryKey: ["mk9-potential-members"] });
    }
  });

  const removeMutation = useMutation({
    mutationFn: (promoterId: string) => removeFn({ data: { promoterId } }),
    onSuccess: () => {
      toast.success("Promotor removido da equipe.");
      queryClient.invalidateQueries({ queryKey: ["mk9-presence-team-details", teamId] });
      queryClient.invalidateQueries({ queryKey: ["mk9-potential-members"] });
    }
  });

  const availableMembers = useMemo(() => {
    if (!potentialMembers || !team) return [];
    
    return potentialMembers.filter(p => {
      // Must not be already in this team
      const isAlreadyInTeam = team.members?.some((m: any) => m.id === p.id);
      if (isAlreadyInTeam) return false;

      // Filter by search
      if (search) {
        const s = search.toLowerCase();
        return p.name.toLowerCase().includes(s) || (p.employee_number || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [potentialMembers, team, search]);

  const toggleSelect = (id: string) => {
    setSelectedPromoterIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAddSelected = () => {
    if (selectedPromoterIds.length === 0) return;
    
    // Check if any selected promoter is already in another team
    const inOtherTeam = potentialMembers?.filter(p => 
      selectedPromoterIds.includes(p.id) && p.presence_team_id && p.presence_team_id !== teamId
    );

    if (inOtherTeam && inOtherTeam.length > 0) {
      // For simplicity in this UI, we just alert if any are in other teams
      // In a more complex UI we'd show the specific team names
      toast.error(`Alguns promotores já pertencem a outras equipes.`);
      // We still proceed with the mutation as the backend handles it by moving them
    }
    
    addMutation.mutate(selectedPromoterIds);
  };

  if (teamLoading) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-command-deep border-white/10 text-white max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-command-purple" />
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              Gerenciar Promotores — <span className="text-command-purple">{team?.name}</span>
            </DialogTitle>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {team?.supervisor?.name || "Sem Supervisor"} • {team?.members?.length || 0} promotores
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-2 gap-6 py-6">
          {/* Members List */}
          <div className="flex flex-col space-y-4 overflow-hidden border-r border-white/5 pr-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                Membros da Equipe ({team?.members?.length || 0})
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {team?.members?.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                  <Users className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Nenhum membro</p>
                </div>
              ) : (
                team?.members?.map((member: any) => (
                  <div key={member.id} className="bg-white/[0.03] border border-white/5 rounded-lg p-3 flex items-center justify-between group">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-white uppercase tracking-tight">
                        {member.employee_number && <span className="text-slate-500 mr-2">{member.employee_number} |</span>}
                        {member.name}
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold">{member.uf || "-"}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeMutation.mutate(member.id)}
                    >
                      <UserMinus className="w-3.5 h-3.5 mr-1" />
                      REMOVER
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Available Promoters */}
          <div className="flex flex-col space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Promotores Disponíveis
              </h3>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Buscar por nome ou matrícula..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 bg-black/40 border-white/10 text-[10px] font-bold text-white uppercase"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {availableMembers.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                  <Search className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Nada encontrado</p>
                </div>
              ) : (
                availableMembers.map((member: any) => {
                  const isSelected = selectedPromoterIds.includes(member.id);
                  const inOtherTeam = member.presence_team_id && member.presence_team_id !== teamId;
                  
                  return (
                    <div 
                      key={member.id} 
                      className={cn(
                        "bg-white/[0.03] border rounded-lg p-3 flex items-center justify-between cursor-pointer transition-all",
                        isSelected ? "border-command-purple/50 bg-command-purple/5" : "border-white/5 hover:border-white/20",
                        inOtherTeam && !isSelected && "opacity-70"
                      )}
                      onClick={() => toggleSelect(member.id)}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                            isSelected ? "bg-command-purple border-command-purple" : "border-white/20 bg-black/20"
                          )}>
                            {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="text-[11px] font-black text-white uppercase tracking-tight">
                            {member.employee_number && <span className="text-slate-500 mr-2">{member.employee_number} |</span>}
                            {member.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-slate-500 font-bold">{member.uf || "-"}</span>
                          {inOtherTeam && (
                            <Badge variant="outline" className="h-3 text-[7px] border-amber-500/30 text-amber-500 uppercase tracking-widest bg-amber-500/5">
                              EM OUTRA EQUIPE
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Button 
              className="w-full bg-command-purple hover:bg-command-purple/80 text-white font-black uppercase text-[10px] tracking-widest h-9"
              disabled={selectedPromoterIds.length === 0 || addMutation.isPending}
              onClick={handleAddSelected}
            >
              {addMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              ADICIONAR SELECIONADOS ({selectedPromoterIds.length})
            </Button>
          </div>
        </div>

        <DialogFooter className="border-t border-white/5 pt-4">
          <Button variant="ghost" className="text-slate-400 hover:text-white font-bold text-[10px] uppercase" onClick={onClose}>
            FECHAR GERENCIAMENTO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
