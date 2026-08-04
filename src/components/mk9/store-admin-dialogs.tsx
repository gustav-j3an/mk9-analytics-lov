import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { 
  mk9CreateStore, 
  mk9UpdateStore,
  mk9ArchiveStore,
  mk9ReactivateStore,
  mk9StoreArchiveImpact
} from "@/lib/mk9-stores.functions";

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
      // Notas contém "Cidade: X" se veio do cadastro simplificado
      const cityMatch = store.notes?.match(/Cidade: (.*)/);
      setCity(cityMatch ? cityMatch[1] : (store.city || ""));
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

export function StoreArchiveDialog({
  open,
  onClose,
  store
}: {
  open: boolean;
  onClose: () => void;
  store: any;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const impactFn = useServerFn(mk9StoreArchiveImpact);
  const archiveFn = useServerFn(mk9ArchiveStore);

  const { data: impact, isLoading } = useQuery({
    queryKey: ["mk9-store-impact", store?.id],
    queryFn: () => impactFn({ data: { id: store.id } }),
    enabled: open && !!store?.id,
  });

  const mut = useMutation({
    mutationFn: async () => archiveFn({ data: { id: store.id, reason } }),
    onSuccess: () => {
      toast.success("Loja arquivada.");
      queryClient.invalidateQueries({ queryKey: ["mk9-stores"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao arquivar loja."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Arquivar Loja
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja arquivar a loja <strong>{store?.name}</strong>?
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Analisando impacto operacional...</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <p className="font-medium">Impacto detectado:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>{impact?.activeFrequencies || 0} frequências vigentes serão encerradas</li>
                <li>{impact?.activeRoutes || 0} roteiros ativos serão arquivados</li>
                <li>{impact?.visits || 0} visitas históricas serão preservadas</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label>Motivo do Arquivamento (Opcional)</Label>
              <Textarea 
                placeholder="Ex: Loja fechada definitivamente..." 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            variant="destructive" 
            onClick={() => mut.mutate()} 
            disabled={isLoading || mut.isPending}
          >
            {mut.isPending ? "Arquivando..." : "Confirmar Arquivamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
