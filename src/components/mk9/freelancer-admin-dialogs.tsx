import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  createFreelancer, 
  updateFreelancer 
} from "@/lib/mk9-freelancers.functions";
import { Loader2 } from "lucide-react";

interface FreelancerFormProps {
  freelancer?: any;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function FreelancerAdminDialog({ freelancer, open, onOpenChange }: FreelancerFormProps) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createFreelancer);
  const updateFn = useServerFn(updateFreelancer);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    city: "",
    uf: "",
    default_daily_rate: "",
    notes: ""
  });

  useEffect(() => {
    if (freelancer) {
      setFormData({
        name: freelancer.name || "",
        phone: freelancer.phone || "",
        city: freelancer.city || "",
        uf: freelancer.uf || "",
        default_daily_rate: freelancer.default_daily_rate?.toString() || "",
        notes: freelancer.notes || ""
      });
    } else {
      setFormData({
        name: "",
        phone: "",
        city: "",
        uf: "",
        default_daily_rate: "",
        notes: ""
      });
    }
  }, [freelancer, open]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        default_daily_rate: data.default_daily_rate ? Number(data.default_daily_rate) : null
      };
      if (freelancer?.id) {
        return updateFn({ data: { ...payload, id: freelancer.id } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mk9-freelancers"] });
      toast.success(freelancer ? "Freelancer atualizado" : "Freelancer cadastrado");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-popover border-border text-foreground">
        <DialogHeader>
          <DialogTitle>{freelancer ? "Editar Freelancer" : "Novo Freelancer"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {freelancer ? "Atualize os dados do freelancer." : "Cadastre um novo freelancer para realizar diárias."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Nome*</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="col-span-3 bg-muted/50 border-border"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="col-span-3 bg-muted/50 border-border"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="city" className="text-right">Cidade</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="col-span-3 bg-muted/50 border-border"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="uf" className="text-right">UF</Label>
            <Input
              id="uf"
              value={formData.uf}
              onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase().slice(0, 2) })}
              className="col-span-3 bg-muted/50 border-border"
              maxLength={2}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="default_daily_rate" className="text-right">Valor Padrão*</Label>
            <Input
              id="default_daily_rate"
              type="number"
              step="0.01"
              value={formData.default_daily_rate}
              onChange={(e) => setFormData({ ...formData, default_daily_rate: e.target.value })}
              className="col-span-3 bg-muted/50 border-border"
              placeholder="Ex: 150.00"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="text-right pt-2">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="col-span-3 bg-muted/50 border-border"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-command-purple hover:bg-command-purple/80" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {freelancer ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
