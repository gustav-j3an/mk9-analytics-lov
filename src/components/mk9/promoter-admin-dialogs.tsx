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
  mk9DeletePromoter,
  mk9PromoterDeleteImpact
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
  const [employeeNumber, setEmployeeNumber] = useState("");

  useEffect(() => {
    if (promoter) {
      setName(promoter.name || "");
      setCity(promoter.city || "");
      setUf(promoter.uf || "");
      setContact(promoter.contact || "");
      setNotes(promoter.notes || "");
      setExternalId(promoter.externalId || "");
      setEmployeeNumber(promoter.employeeNumber || "");
    } else {
      setName("");
      setCity("");
      setUf("");
      setContact("");
      setNotes("");
      setExternalId("");
      setEmployeeNumber("");
    }
  }, [promoter, open]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload = { name, city, uf: uf.toUpperCase(), contact, notes, externalId, employeeNumber };
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
              <Label>Matrícula</Label>
              <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} placeholder="001245" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: São Paulo" />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} maxLength={2} placeholder="SP" />
            </div>
            <div className="space-y-2">
              <Label>ID Externo</Label>
              <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="ERP ID" />
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

export function PromoterDeleteDialog({
  open,
  onClose,
  promoter
}: {
  open: boolean;
  onClose: () => void;
  promoter: any;
}) {
  const queryClient = useQueryClient();
  const impactFn = useServerFn(mk9PromoterDeleteImpact);
  const deleteFn = useServerFn(mk9DeletePromoter);

  const { data: impact, isLoading } = useQuery({
    queryKey: ["mk9-promoter-delete-impact", promoter?.id],
    queryFn: () => impactFn({ data: { id: promoter.id } }),
    enabled: open && !!promoter?.id,
  });

  const mut = useMutation({
    mutationFn: async () => deleteFn({ data: { id: promoter.id } }),
    onSuccess: (res) => {
      toast.success(res.mode === "HARD" ? "Promotor excluído permanentemente." : "Promotor removido da listagem ativa.");
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir promotor."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Promotor
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir o promotor <strong>{promoter?.name}</strong>?
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Analisando histórico operacional...</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nome</p>
                  <p className="font-medium">{promoter?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Matrícula</p>
                  <p className="font-medium">{promoter?.employeeNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">UF</p>
                  <p className="font-medium">{promoter?.uf || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cidade</p>
                  <p className="font-medium">{promoter?.city || "—"}</p>
                </div>
              </div>
            </div>

            {impact && (impact.routes > 0 || impact.visits > 0) ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 space-y-2 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-400">Impacto detectado:</p>
                <p className="text-amber-700 dark:text-amber-500">
                  Este promotor possui vínculos históricos. Para preservar a integridade dos relatórios, ele será <strong>removido da listagem ativa</strong> e não poderá receber novos roteiros.
                </p>
                <ul className="list-disc list-inside space-y-1 text-amber-700/80 dark:text-amber-500/80">
                  <li>{impact.routes} roteiros vinculados</li>
                  <li>{impact.visits} registros de visitas</li>
                </ul>
              </div>
            ) : (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-4 text-sm text-emerald-700 dark:text-emerald-400">
                Este promotor não possui vínculos históricos e será <strong>excluído permanentemente</strong> do banco de dados.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancelar</Button>
          <Button 
            variant="destructive" 
            onClick={() => mut.mutate()} 
            disabled={isLoading || mut.isPending}
          >
            {mut.isPending ? "Excluindo..." : "Confirmar Exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
