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
import { mk9CreateStore, mk9UpdateStore } from "@/lib/mk9-stores.functions";

export function StoreDialog({ 
  open, 
  onClose, 
  store = null 
}: { 
  open: boolean; 
  onClose: () => void; 
  store?: any 
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(mk9CreateStore);
  const updateFn = useServerFn(mk9UpdateStore);

  const [name, setName] = useState("");
  const [chain, setChain] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");

  useEffect(() => {
    if (store) {
      setName(store.name || "");
      setChain(store.chain || "");
      setCity(store.city || "");
      setUf(store.uf || "");
    } else {
      setName("");
      setChain("");
      setCity("");
      setUf("");
    }
  }, [store, open]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload = { name, chain, city, uf: uf.toUpperCase() };
      if (store) {
        return updateFn({ data: { id: store.id, data: payload } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(store ? "Loja atualizada." : "Loja criada.");
      queryClient.invalidateQueries({ queryKey: ["mk9-stores"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar loja."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{store ? "Editar Loja" : "Nova Loja"}</DialogTitle>
          <DialogDescription>Preencha os dados cadastrais da loja.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome da Loja *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Supermercado Central" />
          </div>
          <div className="space-y-2">
            <Label>Rede / Bandeira</Label>
            <Input value={chain} onChange={(e) => setChain(e.target.value)} placeholder="Ex: Carrefour, Pão de Açúcar" />
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
