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
  mk9CreatePromoter, 
  mk9UpdatePromoter,
  mk9ArchivePromoter,
  mk9ReactivatePromoter,
  mk9PromoterArchiveImpact
} from "@/lib/mk9-promoters.functions";

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
  const [externalId, setExternalId] = useState("");

  useEffect(() => {
    if (promoter) {
      setName(promoter.name || "");
      setCity(promoter.city || "");
      setUf(promoter.uf || "");
      setContact(promoter.contact || "");
      setNotes(promoter.notes || "");
      setExternalId(promoter.externalId || "");
    } else {
      setName("");
      setCity("");
      setUf("");
      setContact("");
      setNotes("");
      setExternalId("");
    }
  }, [promoter, open]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload = { name, city, uf: uf.toUpperCase(), contact, notes, externalId };
      if (promoter) {
        return updateFn({ 
          data: { 
            id: promoter.id, 
            data: payload,
            expectedUpdatedAt: promoter.updatedAt
          } 
        });
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
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do promotor" />
            </div>
            <div className="space-y-2">
              <Label>ID Externo</Label>
              <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="ERP ID" />
            </div>
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

export function PromoterArchiveDialog({
  open,
  onClose,
  promoter
}: {
  open: boolean;
  onClose: () => void;
  promoter: any;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const impactFn = useServerFn(mk9PromoterArchiveImpact);
  const archiveFn = useServerFn(mk9ArchivePromoter);

  const { data: impact, isLoading } = useQuery({
    queryKey: ["mk9-promoter-impact", promoter?.id],
    queryFn: () => impactFn({ data: { id: promoter.id } }),
    enabled: open && !!promoter?.id,
  });

  const mut = useMutation({
    mutationFn: async () => archiveFn({ data: { id: promoter.id, reason } }),
    onSuccess: () => {
      toast.success("Promotor arquivado.");
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao arquivar promotor."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Arquivar Promotor
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja arquivar o promotor <strong>{promoter?.name}</strong>?
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
                <li>{impact?.activeRoutes || 0} roteiros ativos serão arquivados</li>
                <li>{impact?.visits || 0} visitas (planejadas/históricas) serão preservadas</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label>Motivo do Arquivamento (Opcional)</Label>
              <Textarea 
                placeholder="Ex: Desligamento, mudança de função..." 
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
