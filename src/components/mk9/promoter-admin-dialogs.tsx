import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mk9CreatePromoter, mk9UpdatePromoter } from "@/lib/mk9-promoters.functions";

export function PromoterDialog({ 
  open, 
  onClose, 
  promoter = null 
}: { 
  open: boolean; 
  onClose: () => void; 
  promoter?: any 
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(mk9CreatePromoter);
  const updateFn = useServerFn(mk9UpdatePromoter);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (promoter) {
      setName(promoter.name || "");
      setCity(promoter.city || "");
      setUf(promoter.uf || "");
      setContact(promoter.contact || "");
      setNotes(promoter.notes || "");
    } else {
      setName("");
      setCity("");
      setUf("");
      setContact("");
      setNotes("");
    }
  }, [promoter, open]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload = { name, city, uf: uf.toUpperCase(), contact, notes };
      if (promoter) {
        return updateFn({ data: { id: promoter.id, data: payload } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(promoter ? "Promotor atualizado." : "Promotor criado.");
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar promotor."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{promoter ? "Editar Promotor" : "Novo Promotor"}</DialogTitle>
          <DialogDescription>Dados cadastrais do promotor de campo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do promotor" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3 space-y-2">
              <Label>Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: São Paulo" />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} maxLength={2} placeholder="SP" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Contato (Telefone/Email)</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!name || mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
