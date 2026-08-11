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
import { Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
          industryIds: [it.industry_id]
        })) || []
      });
      
      // Group items if needed (preserving data but not showing in form)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.freelancerId) {
      toast.error("Selecione um freelancer");
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-popover border-border text-foreground">
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

          {/* TEMPORARILY REMOVED: Atendimentos (Lojas/Indústrias) */}
          <div className="p-6 rounded-lg border border-dashed border-border/50 bg-muted/20 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest text-foreground/80">Gestão de Atendimentos</p>
              <p className="text-[10px] text-muted-foreground font-medium italic">
                Os atendimentos serão configurados após o cadastro inicial da diária.
              </p>
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
