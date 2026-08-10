import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Users, Save, X, Settings } from "lucide-react";
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
  listSupervisors 
} from "@/lib/mk9-presence-teams.functions";

export function PresenceTeamsManager() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listPresenceTeams);
  const createFn = useServerFn(createPresenceTeam);
  const updateFn = useServerFn(updatePresenceTeam);
  const archiveFn = useServerFn(archivePresenceTeam);
  const supervisorsFn = useServerFn(listSupervisors);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
          <div key={team.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{team.name}</p>
              <p className="text-[10px] uppercase text-slate-500">Supervisor: {team.supervisor?.name || team.supervisor?.full_name || "Não definido"}</p>
            </div>
            <div className="flex gap-2">
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
                {supervisors?.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
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
