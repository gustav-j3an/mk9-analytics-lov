import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  Plus
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
  Mk9PageHeader,
  Mk9MetricCard,
  Mk9Panel,
  Mk9LoadingState,
  Mk9EmptyState,
} from "./mk9/design-system";
import { getPresenceList, savePresenceBulk, getPresenceStats } from "@/lib/mk9-presence.functions";

export function Mk9PresenceModule() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [ufFilter, setUfFilter] = useState("__ALL__");
  const [localPresence, setLocalPresence] = useState<Record<string, { status: any, observation: string }>>({});

  const listFn = useServerFn(getPresenceList);
  const saveFn = useServerFn(savePresenceBulk);
  const statsFn = useServerFn(getPresenceStats);

  const { data: presenceItems, isLoading: listLoading } = useQuery({
    queryKey: ["mk9-presence-list", date, search, ufFilter],
    queryFn: () => listFn({ data: { date, filters: { search, uf: ufFilter } } }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["mk9-presence-stats", date],
    queryFn: () => statsFn({ data: { date } }),
  });

  // Reset local state when data loads or date changes
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
    
    const data = presenceItems.map(item => ({
      'DATA': format(parseISO(date), "dd/MM/yyyy"),
      'NOME': item.name,
      'MATRÍCULA': item.registration_number || "-",
      'STATUS': localPresence[item.id]?.status === 'PRESENT' ? 'PRESENTE' :
                localPresence[item.id]?.status === 'ABSENT' ? 'FALTA' :
                localPresence[item.id]?.status === 'MEDICAL_CERTIFICATE' ? 'ATESTADO' : 'NÃO MARCADO',
      'OBSERVAÇÃO': localPresence[item.id]?.observation || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presença");
    XLSX.writeFile(wb, `PRESENCA-${date}.xlsx`);
  };

  // Local stats calculation for immediate feedback
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
          <div className="flex items-center gap-2 glass-command p-1.5 rounded-xl border border-white/5">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-[140px] bg-black/40 border-white/5 text-[10px] font-bold text-white uppercase tracking-wider"
            />
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="h-8 gap-2 bg-command-purple hover:bg-command-purple/80 text-white border-none uppercase text-[10px] font-black tracking-widest px-4"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            <Button
              onClick={exportToExcel}
              variant="outline"
              className="h-8 gap-2 border-white/10 text-slate-400 hover:text-white uppercase text-[10px] font-black tracking-widest px-4"
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
             <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
               Lista de Presença
             </h3>
             <Button 
               variant="outline" 
               size="sm"
               onClick={markAllPresent}
               className="h-7 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest"
             >
               Marcar todos como Presente
             </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Nome ou matrícula..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-[220px] bg-command-deep border-white/10 text-white text-xs"
              />
            </div>
            <Select value={ufFilter} onValueChange={setUfFilter}>
              <SelectTrigger className="h-9 w-[80px] bg-command-deep border-white/10 text-white text-xs">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10 text-white">
                <SelectItem value="__ALL__">TODAS</SelectItem>
                {ufs.map(uf => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 overflow-hidden">
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
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Promotor</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Matrícula</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 text-center w-[300px]">Status</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {presenceItems.map((item) => {
                    const local = localPresence[item.id] || { status: null, observation: "" };
                    return (
                      <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white uppercase tracking-tighter">{item.name}</span>
                            <span className="text-[9px] text-slate-500 font-bold">{item.uf || "-"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-slate-400">
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
                            className="h-7 text-[10px] bg-transparent border-white/5 focus:border-white/20 text-slate-300 w-full"
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
    present: { label: 'Presente', icon: Check, activeClass: 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]', inactiveClass: 'text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20' },
    absent: { label: 'Falta', icon: X, activeClass: 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]', inactiveClass: 'text-rose-500 hover:bg-rose-500/10 border-rose-500/20' },
    medical: { label: 'Atestado', icon: Plus, activeClass: 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]', inactiveClass: 'text-amber-500 hover:bg-amber-500/10 border-amber-500/20' }
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
