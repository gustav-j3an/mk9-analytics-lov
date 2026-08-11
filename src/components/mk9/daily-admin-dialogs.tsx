import { useState, useEffect, useMemo } from "react";
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
import { Loader2, Plus, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

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
    items: []
  });

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
        items: daily.items?.map((it: any) => ({
          storeId: it.store_id,
          industryIds: [it.industry_id] // We'll group them by store in a moment
        })) || []
      });
      
      // Group items by store for the UI
      if (daily.items) {
        const grouped: any[] = [];
        daily.items.forEach((it: any) => {
          const existing = grouped.find(g => g.storeId === it.store_id);
          if (existing) {
            if (!existing.industryIds.includes(it.industry_id)) {
              existing.industryIds.push(it.industry_id);
            }
          } else {
            grouped.push({
              storeId: it.store_id,
              industryIds: [it.industry_id]
            });
          }
        });
        setFormData((prev: any) => ({ ...prev, items: grouped }));
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
        items: []
      });
    }
  }, [daily, open]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        amount: Number(data.amount),
        supervisorId: data.supervisorId || null
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

  const addItem = () => {
    setFormData((prev: any) => ({
      ...prev,
      items: [...(prev.items || []), { storeId: "", industryIds: [] as string[] }]
    }));

  };

  const removeItem = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      items: prev.items.filter((_: any, i: number) => i !== index)
    }));
  };

  const updateItem = (index: number, updates: any) => {
    setFormData((prev: any) => ({
      ...prev,
      items: prev.items.map((it: any, i: number) => i === index ? { ...it, ...updates } : it)
    }));
  };

  const toggleIndustry = (itemIndex: number, industryId: string) => {
    setFormData((prev: any) => {
      const newItems = [...(prev.items || [])];
      const item = { ...newItems[itemIndex] };
      
      // Garantir que industryIds seja sempre um array
      const currentIndustries = Array.isArray(item.industryIds) ? item.industryIds : [];
      
      const exists = currentIndustries.includes(industryId);
      item.industryIds = exists
        ? currentIndustries.filter((id: string) => id !== industryId)
        : [...currentIndustries, industryId];
        
      newItems[itemIndex] = item;
      return { ...prev, items: newItems };
    });
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.freelancerId) {
      toast.error("Selecione um freelancer");
      return;
    }
    if (formData.items.length === 0) {
      toast.error("Adicione pelo menos um atendimento");
      return;
    }
    const invalidItem = formData.items.some((it: any) => !it.storeId || it.industryIds.length === 0);
    if (invalidItem) {
      toast.error("Preencha a loja e selecione indústrias para todos os atendimentos");
      return;
    }
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
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="text-command-purple h-auto p-1 block w-full"
                        onClick={() => {
                          onOpenChange(false);
                          // We'll trust the user to navigate or we can try to provide a better UX
                          // For now, let's just show the message as requested in point 33
                        }}
                      >
                        Cadastrar Freelancer
                      </Button>
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

          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/50 pb-2">
              <Label className="text-lg font-bold">Atendimentos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="border-border hover:bg-accent">
                <Plus className="w-4 h-4 mr-1" /> Adicionar Loja
              </Button>
            </div>

            <div className="space-y-4">
              {formData.items.map((item: any, idx: number) => (
                <div key={idx} className="p-4 rounded-lg bg-muted/50 border border-border space-y-4 relative">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <div className="space-y-2 pr-8">
                    <Label className="flex items-center gap-1.5">
                      Loja*
                      <Badge variant="outline" className="text-[9px] px-1 h-4 bg-blue-500/10 text-blue-500 border-none">UNIDADE OPERACIONAL</Badge>
                    </Label>
                    <Mk9StoreAutocomplete 
                      value={item.storeId} 
                      onChange={(store) => updateItem(idx, { 
                        storeId: store.id,
                        _storeLabel: store.name // Armazenamos o label localmente para exibição estável
                      })}
                      placeholder="Pesquisar loja por nome, rede, cidade ou UF..."
                    />
                    {item._storeLabel && item.storeId && (
                      <div className="text-[10px] font-bold text-primary px-1 mt-1">
                        SELECIONADO: {item._storeLabel}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      Indústrias*
                      <Badge variant="outline" className="text-[9px] px-1 h-4 bg-emerald-500/10 text-emerald-500 border-none">CONTRATANTES</Badge>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-background/40 rounded-md">
                      {industriesQ.data?.map((ind: any) => {
                        const isChecked = Array.isArray(item.industryIds) && item.industryIds.includes(ind.id);
                        return (
                          <div 
                            key={`attendance-${idx}-industry-${ind.id}`} 
                            className="flex items-center space-x-2 hover:bg-muted/50 p-1 rounded transition-colors cursor-pointer group"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log(`[DEBUG] Toggling industry ${ind.id} for attendance ${idx}`);
                              toggleIndustry(idx, ind.id);
                            }}
                          >
                            <input 
                              type="checkbox"
                              id={`ind-${idx}-${ind.id}`}
                              checked={isChecked}
                              onChange={() => {}} // Controlled by click on parent
                              className="w-4 h-4 rounded border-gray-300 text-command-purple focus:ring-command-purple pointer-events-none"
                            />
                            <label 
                              htmlFor={`ind-${idx}-${ind.id}`}
                              className="text-xs text-foreground/80 select-none group-hover:text-foreground transition-colors pointer-events-none"
                            >
                              {ind.name}
                            </label>
                          </div>
                        );
                      })}
                      
                      {/* Debug Temporário */}
                      <div className="col-span-full mt-2 pt-2 border-t border-border/30 text-[9px] font-mono text-muted-foreground">
                        DEBUG: Store: {item.storeId || "null"} | IDs: {JSON.stringify(item.industryIds || [])}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
              
              {formData.items.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-border/50 rounded-lg text-muted-foreground italic">
                  Nenhuma loja adicionada.
                </div>
              )}
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
              {daily ? "Salvar Diária" : "Registrar Diária"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
