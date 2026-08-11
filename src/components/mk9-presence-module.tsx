import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSupervisors } from "@/lib/mk9-supervisors.functions";
import { cn } from "@/lib/utils";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  PlusCircle, 
  Search, 
  Save, 
  Calendar as CalendarIcon, 
  Download, 
  Loader2,
  Filter,
  Check,
  X,
  Plus,
  Settings
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Mk9PageHeader,
  Mk9MetricCard,
  Mk9Panel,
  Mk9LoadingState,
  Mk9EmptyState,
} from "./mk9/design-system";
import { getPresenceList, savePresenceBulk, getPresenceStats } from "@/lib/mk9-presence.functions";
import { listPresenceTeams } from "@/lib/mk9-presence-teams.functions";
import { PresenceTeamsManager } from "./mk9-presence-teams-manager";

export function Mk9PresenceModule() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [ufFilter, setUfFilter] = useState("__ALL__");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [supervisorFilter, setSupervisorFilter] = useState("ALL");
  const [localPresence, setLocalPresence] = useState<Record<string, { status: any, observation: string }>>({});

  const listFn = useServerFn(getPresenceList);
  const saveFn = useServerFn(savePresenceBulk);
  const statsFn = useServerFn(getPresenceStats);
  const listTeamsFn = useServerFn(listPresenceTeams);
  const listSupervisorsFn = useServerFn(listSupervisors);

  const { data: presenceItems, isLoading: listLoading } = useQuery({
    queryKey: ["mk9-presence-list", date, search, ufFilter, teamFilter, supervisorFilter],
    queryFn: () => listFn({ data: { date, filters: { search, uf: ufFilter, teamId: teamFilter, supervisorId: supervisorFilter } } }),
  });

  const { data: teams } = useQuery({
    queryKey: ["mk9-presence-teams-list"],
    queryFn: () => listTeamsFn(),
  });

  const { data: supervisors } = useQuery({
    queryKey: ["mk9-supervisors-list"],
    queryFn: () => listSupervisorsFn(),
  });

  const { data: stats } = useQuery({
    queryKey: ["mk9-presence-stats", date, teamFilter, supervisorFilter],
    queryFn: () => statsFn({ data: { date, teamId: teamFilter, supervisorId: supervisorFilter } }),
  });

  useEffect(() => {
    if (presenceItems) {
      const newState: Record<string, { status: any, observation: string }> = {};
      presenceItems.forEach(item => {
        newState[item.id] = { 
          status: item.status || null, 
          observation: item.observation || "" 
        };
      });
      setLocalPresence(newState);
    }
  }, [presenceItems]);

  const saveMutation = useMutation({
    mutationFn: (items: any[]) => saveFn({ data: { date, items } }),
    onSuccess: () => {
      toast.success(`Presença de ${format(parseISO(date), "dd/MM/yyyy")} salva com sucesso.`);
      queryClient.invalidateQueries({ queryKey: ["mk9-presence-list"] });
      queryClient.invalidateQueries({ queryKey: ["mk9-presence-stats"] });
    },
    onError: () => {
      toast.error("Erro ao salvar presença.");
    }
  });

  const handleStatusChange = (promoterId: string, status: any) => {
    setLocalPresence(prev => ({
      ...prev,
      [promoterId]: { ...prev[promoterId], status }
    }));
  };

  const handleObservationChange = (promoterId: string, observation: string) => {
    setLocalPresence(prev => ({
      ...prev,
      [promoterId]: { ...prev[promoterId], observation }
    }));
  };

  const markAllPresent = () => {
    if (!presenceItems) return;
    const newState = { ...localPresence };
    presenceItems.forEach(item => {
      newState[item.id] = { ...newState[item.id], status: 'PRESENT' };
    });
    setLocalPresence(newState);
  };

  const handleSave = () => {
    const items = Object.entries(localPresence)
      .filter(([_, data]) => data.status !== null)
      .map(([id, data]) => ({
        promoterId: id,
        status: data.status,
        observation: data.observation
      }));

    if (items.length === 0) {
      toast.error("Nenhuma presença marcada para salvar.");
      return;
    }
    saveMutation.mutate(items);
  };

  const exportToExcel = () => {
    if (!presenceItems) return;
    
    const teamLabel = teamFilter === 'ALL' ? 'TODOS' : 
                      teamFilter === 'NONE' ? 'SEM EQUIPE' : 
                      teams?.find(t => t.id === teamFilter)?.name || 'EQUIPE';

    const supervisorLabel = supervisorFilter === 'ALL' ? 'TODOS' :
                            supervisorFilter === 'NONE' ? 'SEM SUPERVISOR' :
                            supervisors?.find(s => s.id === supervisorFilter)?.name || '—';

    const headerRows = [
      ['MK9 TRADE'],
      ['CONTROLE DE PRESENÇA'],
      [''],
      ['Equipe:', teamLabel],
      ['Supervisor:', supervisorLabel],
      ['Data:', format(parseISO(date), "dd/MM/yyyy")],
      [''],
      ['MATRÍCULA', 'NOME', 'UF', 'STATUS', 'OBSERVAÇÃO']
    ];

    const dataRows = presenceItems.map(item => [
      item.registration_number || "-",
      item.name,
      item.uf || "-",
      localPresence[item.id]?.status === 'PRESENT' ? 'PRESENTE' :
      localPresence[item.id]?.status === 'ABSENT' ? 'FALTA' :
      localPresence[item.id]?.status === 'MEDICAL_CERTIFICATE' ? 'ATESTADO' : 'NÃO MARCADO',
      localPresence[item.id]?.observation || "-"
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presença");
    
    const fileName = `PRESENCA - ${teamLabel} - ${format(parseISO(date), "dd-MM-yyyy")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const localStats = useMemo(() => {
    const s = { present: 0, absent: 0, medical: 0, unmarked: 0 };
    Object.values(localPresence).forEach(p => {
      if (p.status === 'PRESENT') s.present++;
      else if (p.status === 'ABSENT') s.absent++;
      else if (p.status === 'MEDICAL_CERTIFICATE') s.medical++;
      else s.unmarked++;
    });
    return s;
  }, [localPresence]);

  const ufs = useMemo(() => {
    if (!presenceItems) return [];
    const set = new Set(presenceItems.map(p => p.uf).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [presenceItems]);

  return (
    <div className="space-y-8 animate-fade-up">
      <Mk9PageHeader
        title="Controle de Presença"
        subtitle="Registro operacional diário de comparecimento"
        icon={CheckCircle2}
        actions={
          <div className="flex items-center gap-2 glass-command p-1.5 rounded-xl border border-border/50">
            <div className="relative group/date shrink-0">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 w-[170px] bg-input/50 border-border/50 text-[10px] font-bold text-foreground uppercase tracking-wider pr-8"
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-8 w-8 p-0 border-border text-muted-foreground hover:text-foreground">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-popover border-l-border text-foreground w-[400px]">
                <SheetHeader>
                  <SheetTitle className="text-foreground uppercase tracking-tighter">Gestão de Equipes</SheetTitle>
                </SheetHeader>
                <div className="py-6">
                  <PresenceTeamsManager />
                </div>
              </SheetContent>
            </Sheet>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="h-8 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground border-none uppercase text-[10px] font-black tracking-widest px-4"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            <Button
              onClick={exportToExcel}
              variant="outline"
              className="h-8 gap-2 border-border text-muted-foreground hover:text-foreground uppercase text-[10px] font-black tracking-widest px-4"
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Mk9MetricCard label="Total Promotores" value={presenceItems?.length ?? 0} color="blue" />
        <Mk9MetricCard label="Presentes" value={localStats.present} color="emerald" />
        <Mk9MetricCard label="Faltas" value={localStats.absent} color="rose" />
        <Mk9MetricCard label="Atestados" value={localStats.medical} color="amber" />
        <Mk9MetricCard label="Não Marcados" value={Math.max(0, (presenceItems?.length ?? 0) - (localStats.present + localStats.absent + localStats.medical))} color="blue" hint="Pendentes" />
      </div>

      <Mk9Panel>
        <div className="space-y-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground whitespace-nowrap">
              Lista de Presença
            </h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={markAllPresent}
              className="h-9 sm:h-7 w-full sm:w-auto border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest"
            >
              Marcar todos como Presente
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nome ou matrícula..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-full bg-popover border-border text-foreground text-xs"
              />
            </div>
            
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-9 w-full bg-popover border-border text-foreground text-[10px] font-bold uppercase tracking-wider">
                <SelectValue placeholder="EQUIPE" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-foreground">
                <SelectItem value="ALL">TODAS EQUIPES</SelectItem>
                <SelectItem value="NONE">SEM EQUIPE (AVULSOS)</SelectItem>
                {teams?.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
              <SelectTrigger className="h-9 w-full bg-popover border-border text-foreground text-[10px] font-bold uppercase tracking-wider">
                <SelectValue placeholder="SUPERVISOR" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-foreground">
                <SelectItem value="ALL">TODOS SUPERVISORES</SelectItem>
                <SelectItem value="NONE">SEM SUPERVISOR</SelectItem>
                {supervisors?.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ufFilter} onValueChange={setUfFilter}>
              <SelectTrigger className="h-9 w-full bg-popover border-border text-foreground text-[10px] font-bold uppercase tracking-wider">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-foreground">
                <SelectItem value="__ALL__">TODAS</SelectItem>
                {ufs.map(uf => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 overflow-hidden">
          {listLoading ? (
            <Mk9LoadingState message="Carregando promotores..." />
          ) : !presenceItems || presenceItems.length === 0 ? (
            <Mk9EmptyState 
              message="Nenhum promotor encontrado. Verifique se há promotores ativos no cadastro ou ajuste os filtros." 
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Promotor</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Matrícula</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground text-center w-[300px]">Status</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {presenceItems.map((item) => {
                    const local = localPresence[item.id] || { status: null, observation: "" };
                    return (
                      <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-foreground uppercase tracking-tighter">{item.name}</span>
                            <span className="text-[9px] text-muted-foreground font-bold">{item.uf || "-"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-muted-foreground">
                          {item.registration_number || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <PresenceButton 
                              active={local.status === 'PRESENT'} 
                              onClick={() => handleStatusChange(item.id, 'PRESENT')}
                              variant="present"
                            />
                            <PresenceButton 
                              active={local.status === 'ABSENT'} 
                              onClick={() => handleStatusChange(item.id, 'ABSENT')}
                              variant="absent"
                            />
                            <PresenceButton 
                              active={local.status === 'MEDICAL_CERTIFICATE'} 
                              onClick={() => handleStatusChange(item.id, 'MEDICAL_CERTIFICATE')}
                              variant="medical"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            placeholder="..."
                            value={local.observation}
                            onChange={(e) => handleObservationChange(item.id, e.target.value)}
                            className="h-7 text-[10px] bg-transparent border-border/50 focus:border-primary text-foreground/80 w-full"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Mk9Panel>
    </div>
  );
}

function PresenceButton({ active, onClick, variant }: { active: boolean, onClick: () => void, variant: 'present' | 'absent' | 'medical' }) {
  const configs = {
    present: { label: 'Presente', icon: Check, activeClass: 'bg-emerald-500 text-white shadow-sm', inactiveClass: 'text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20' },
    absent: { label: 'Falta', icon: X, activeClass: 'bg-rose-500 text-white shadow-sm', inactiveClass: 'text-rose-500 hover:bg-rose-500/10 border-rose-500/20' },
    medical: { label: 'Atestado', icon: Plus, activeClass: 'bg-amber-500 text-white shadow-sm', inactiveClass: 'text-amber-500 hover:bg-amber-500/10 border-amber-500/20' }
  };
  
  const config = configs[variant];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 h-7 rounded-md text-[9px] font-black uppercase tracking-tight transition-all border",
        active ? config.activeClass : config.inactiveClass
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </button>
  );
}
