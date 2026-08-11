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
  mk9StoreArchiveImpact,
} from "@/lib/mk9-stores.functions";

export function StoreDialog({
  open,
  onClose,
  store = null,
}: {
  open: boolean;
  onClose: () => void;
  store?: any;
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
      setCity(cityMatch ? cityMatch[1] : store.city || "");
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
      queryClient.invalidateQueries({ queryKey: ["mk9-stores-admin"] });
      queryClient.invalidateQueries({ queryKey: ["mk9-stores"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar loja."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-mk9-accent-primary uppercase">
            {store ? "Editar Loja" : "Nova Loja"}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {store ? "Atualizar dados da unidade" : "Cadastro de nova unidade operacional"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Nome da Loja *
            </Label>
            <Input
              className="bg-input/50 border-border h-10 text-foreground"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Supermercado Central"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Rede / Bandeira
            </Label>
            <Input
              className="bg-input/50 border-border h-10 text-foreground"
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              placeholder="Ex: Carrefour, Pão de Açúcar"
            />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3 space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Cidade
              </Label>
              <Input
                className="bg-input/50 border-border h-10 text-foreground"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                UF
              </Label>
              <Input
                className="bg-input/50 border-border h-10 text-foreground font-mono"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="SP"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4 border-t border-border/50 pt-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            CANCELAR
          </Button>
          <Button
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-foreground font-bold"
            onClick={() => mut.mutate()}
            disabled={!name || mut.isPending}
          >
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "SALVAR LOJA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StoreArchiveDialog({
  open,
  onClose,
  store,
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
      queryClient.invalidateQueries({ queryKey: ["mk9-stores-admin"] });
      queryClient.invalidateQueries({ queryKey: ["mk9-stores"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao arquivar loja."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-500 uppercase font-black tracking-tighter">
            <AlertTriangle className="h-5 w-5" />
            Arquivar Loja
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Esta ação é uma exclusão lógica reversível.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-mk9-accent-primary/20" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              Analisando impacto operacional...
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
              <p className="text-xs font-bold text-rose-400 uppercase tracking-tight">
                Impacto Detectado na Unidade:
              </p>
              <ul className="space-y-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <li className="flex justify-between border-b border-border/50 pb-1">
                  <span>Frequências vigentes:</span>{" "}
                  <span className="text-foreground">{impact?.activeFrequencies || 0}</span>
                </li>
                <li className="flex justify-between border-b border-border/50 pb-1">
                  <span>Roteiros ativos:</span>{" "}
                  <span className="text-foreground">{impact?.activeRoutes || 0}</span>
                </li>
                <li className="flex justify-between">
                  <span>Visitas históricas:</span>{" "}
                  <span className="text-muted-foreground">{impact?.visits || 0} (Preservadas)</span>
                </li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Motivo do Arquivamento (Opcional)
              </Label>
              <Textarea
                className="bg-input/50 border-border text-foreground min-h-[80px]"
                placeholder="Ex: Loja fechada definitivamente..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 border-t border-border/50 pt-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            CANCELAR
          </Button>
          <Button
            className="bg-rose-500 hover:bg-rose-600 text-foreground font-bold px-6 shadow-lg shadow-rose-500/20"
            onClick={() => mut.mutate()}
            disabled={isLoading || mut.isPending}
          >
            {mut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "CONFIRMAR ARQUIVAMENTO"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
