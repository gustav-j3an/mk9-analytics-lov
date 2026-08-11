import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  createDaily, 
  updateDaily 
} from "@/lib/mk9-freelancer-dailies.functions";
import { listFreelancers } from "@/lib/mk9-freelancers.functions";
import { listSupervisors } from "@/lib/mk9-supervisors.functions";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";
import { Mk9StoreAutocomplete } from "@/components/mk9/store-autocomplete";
import { Loader2, Plus, Trash2, Info, Building2 as Store } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyAttendanceDraft {
  id: string;
  storeId: string;
  industryIds: string[];
}

interface DailyFormProps {
  daily?: any;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function DailyAdminDialog({ daily, open, onOpenChange }: DailyFormProps) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createDaily);
  const updateFn = useServerFn(updateDaily);
  const freelancersFn = useServerFn(listFreelancers);
  const supervisorsFn = useServerFn(listSupervisors);
  const industriesFn = useServerFn(mk9ListIndustries);

  const [formData, setFormData] = useState<any>({
    freelancerId: "",
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    status: "PLANEJADA",
    paymentStatus: "A PAGAR",
    paymentDate: null,
    supervisorId: "",
    notes: "",
  });

  // MISSÃO 2: Novo estado de atendimentos isolado
  const [attendances, setAttendances] = useState<DailyAttendanceDraft[]>([]);

  const freelancersQ = useQuery({ 
    queryKey: ["mk9-freelancers-active"], 
    queryFn: () => freelancersFn({ data: { includeInactive: false } }),
    enabled: open 
  });
  
  const supervisorsQ = useQuery({ 
    queryKey: ["mk9-supervisors-active"], 
    queryFn: () => supervisorsFn(),
    enabled: open
  });

  const industriesQ = useQuery({
    queryKey: ["mk9-industries-list"],
    queryFn: () => industriesFn(),
    enabled: open
  });

  useEffect(() => {
    if (daily) {
      setFormData({
        freelancerId: daily.freelancer_id || "",
        date: daily.date || new Date().toISOString().split('T')[0],
        amount: Number(daily.amount) || 0,
        status: daily.status || "PLANEJADA",
        paymentStatus: daily.payment_status || "A PAGAR",
        paymentDate: daily.payment_date || null,
        supervisorId: daily.supervisor_id || "",
        notes: daily.notes || "",
      });
      
      // Reconstituir atendimentos para edição
      if (daily.items) {
        const grouped: DailyAttendanceDraft[] = [];
        daily.items.forEach((it: any) => {
          const existing = grouped.find(g => g.storeId === it.store_id);
          if (existing) {
            if (!existing.industryIds.includes(it.industry_id)) {
              existing.industryIds.push(it.industry_id);
            }
          } else {
            grouped.push({
              id: crypto.randomUUID(),
              storeId: it.store_id,
              industryIds: [it.industry_id]
            });
          }
        });
        setAttendances(grouped);
      } else {
        setAttendances([{ id: crypto.randomUUID(), storeId: "", industryIds: [] }]);
      }
    } else {
      setFormData({
        freelancerId: "",
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        status: "PLANEJADA",
        paymentStatus: "A PAGAR",
        paymentDate: null,
        supervisorId: "",
        notes: "",
      });
      setAttendances([{ id: crypto.randomUUID(), storeId: "", industryIds: [] }]);
    }
  }, [daily, open]);

  // MISSÃO 2: Handlers novos e isolados
  const addAttendance = () => {
    setAttendances(prev => [
      ...prev, 
      { id: crypto.randomUUID(), storeId: "", industryIds: [] }
    ]);
  };

  const removeAttendance = (id: string) => {
    if (attendances.length <= 1) {
      // Regra: mantém pelo menos um vazio se for o último
      setAttendances([{ id: crypto.randomUUID(), storeId: "", industryIds: [] }]);
      return;
    }
    setAttendances(prev => prev.filter(a => a.id !== id));
  };

  const updateStore = (id: string, storeId: string) => {
    setAttendances(prev => prev.map(a => 
      a.id === id ? { ...a, storeId } : a
    ));
  };

  const toggleIndustry = (attendanceId: string, industryId: string) => {
    setAttendances(prev => prev.map(a => {
      if (a.id !== attendanceId) return a;
      
      const currentIds = Array.isArray(a.industryIds) ? a.industryIds : [];
      const exists = currentIds.includes(industryId);
      
      return {
        ...a,
        industryIds: exists 
          ? currentIds.filter(id => id !== industryId)
          : [...currentIds, industryId]
      };
    }));
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // MISSÃO 2: NÃO integrar ao banco ainda, mas mantemos o payload base
      // para garantir que a diária (sem itens) salve se necessário.
      // O payload 'items' será ignorado ou enviado vazio conforme o schema v1.9.0.
      const payload = {
        ...data,
        amount: Number(data.amount),
        supervisorId: data.supervisorId || null,
        items: [] // Temporariamente vazio para MISSÃO 2
      };
      if (daily?.id) {
        return updateFn({ data: { ...payload, id: daily.id } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mk9-freelancer-dailies"] });
      toast.success(daily ? "Diária atualizada" : "Diária registrada");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.freelancerId) {
      toast.error("Selecione um freelancer");
      return;
    }
    // MISSÃO 2: Apenas logamos para validar o estado no console/tela
    console.log("Submit Draft Attendances:", attendances);
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-popover border-border text-foreground">
        <DialogHeader>
          <DialogTitle>{daily ? "Editar Diária" : "Nova Diária"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Freelancer*</Label>
              <Select 
                value={formData.freelancerId} 
                onValueChange={(val) => {
                  const freelancer = freelancersQ.data?.find((f: any) => f.id === val);
                  setFormData({ 
                    ...formData, 
                    freelancerId: val,
                    amount: freelancer?.default_daily_rate || formData.amount
                  });
                }}
              >
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {freelancersQ.data?.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      Nenhum freelancer ativo.
                    </div>
                  ) : (
                    freelancersQ.data?.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data*</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-muted/50 border-border"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor da Diária (R$)*</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="bg-muted/50 border-border"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Supervisor Responsável</Label>
              <Select 
                value={formData.supervisorId || "__none__"} 
                onValueChange={(val) => setFormData({ ...formData, supervisorId: val === "__none__" ? "" : val })}
              >
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {supervisorsQ.data?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(val) => setFormData({ ...formData, status: val })}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANEJADA">PLANEJADA</SelectItem>
                <SelectItem value="REALIZADA">REALIZADA</SelectItem>
                <SelectItem value="CANCELADA">CANCELADA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status Financeiro</Label>
              <Select 
                value={formData.paymentStatus} 
                onValueChange={(val) => setFormData({ 
                  ...formData, 
                  paymentStatus: val,
                  paymentDate: val === 'PAGO' ? (formData.paymentDate || new Date().toISOString().split('T')[0]) : null
                })}
              >
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A PAGAR">A PAGAR</SelectItem>
                  <SelectItem value="PAGO">PAGO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.paymentStatus === 'PAGO' && (
              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={formData.paymentDate || ""}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                  className="bg-muted/50 border-border"
                />
              </div>
            )}
          </div>

          {/* MISSÃO 2: Reconstrução dos Atendimentos */}
          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-black uppercase tracking-tighter">Atendimentos</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addAttendance}
                className="h-8 border-primary/30 text-primary hover:bg-primary/10 font-bold"
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar Loja
              </Button>
            </div>

            <div className="space-y-4">
              {attendances.map((att, idx) => (
                <div key={att.id} className="p-4 rounded-xl border border-border bg-card/50 space-y-4 relative group">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                    onClick={() => removeAttendance(att.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <div className="space-y-2 pr-8">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <Store className="w-3 h-3" /> Atendimento {idx + 1} - Loja*
                    </Label>
                    <Mk9StoreAutocomplete 
                      value={att.storeId} 
                      onChange={(store) => updateStore(att.id, store.id)}
                      placeholder="Pesquisar loja (Nome, Rede, Cidade ou UF)..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <Info className="w-3 h-3" /> Indústrias*
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border border-border/30">
                      {industriesQ.data?.map((ind: any) => (
                        <div key={`${att.id}-${ind.id}`} className="flex items-center gap-2 group/item cursor-pointer">
                          <input 
                            type="checkbox"
                            id={`${att.id}-${ind.id}`}
                            checked={att.industryIds.includes(ind.id)}
                            onChange={() => toggleIndustry(att.id, ind.id)}
                            className="w-4 h-4 accent-command-purple cursor-pointer"
                          />
                          <label 
                            htmlFor={`${att.id}-${ind.id}`}
                            className="text-xs text-foreground/80 cursor-pointer select-none group-hover/item:text-foreground transition-colors"
                          >
                            {ind.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DEBUG VISUAL TEMPORÁRIO */}
                  <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                    <p className="text-[8px] font-mono text-primary/60 uppercase tracking-tighter">Debug Operacional:</p>
                    <p className="text-[9px] font-mono text-foreground/70">storeId: {att.storeId || "null"}</p>
                    <p className="text-[9px] font-mono text-foreground/70">industryIds: {JSON.stringify(att.industryIds)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações Gerais</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-muted/50 border-border"
              placeholder="Informações adicionais sobre a diária..."
            />
          </div>

          <DialogFooter className="sticky bottom-0 bg-popover pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-command-purple hover:bg-command-purple/80" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {daily ? "Salvar Alterações" : "Criar Diária"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
