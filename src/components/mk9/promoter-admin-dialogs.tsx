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
  mk9PromoterDeleteImpact,
} from "@/lib/mk9-promoters.functions";

export function PromoterDialog({
  open,
  onClose,
  promoter = null,
}: {
  open: boolean;
  onClose: () => void;
  promoter?: any;
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
      const payload = {
        name,
        city,
        uf: uf.toUpperCase(),
        contact,
        notes,
        externalId,
        employeeNumber,
      };
      if (promoter) {
        return updateFn({
          data: {
            id: promoter.id,
            data: payload,
            expectedUpdatedAt: promoter.updatedAt,
          },
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
      <DialogContent className="bg-command-deep border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-mk9-accent-primary uppercase">
            {promoter ? "Editar Promotor" : "Novo Promotor"}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {promoter ? "Gerenciamento de perfil operacional" : "Inclusão de novo agente de campo"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                Nome Completo *
              </Label>
              <Input
                className="bg-black/40 border-white/10 h-10 text-white"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do promotor"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                Matrícula
              </Label>
              <Input
                className="bg-black/40 border-white/10 h-10 text-white"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="001245"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                Cidade
              </Label>
              <Input
                className="bg-black/40 border-white/10 h-10 text-white"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                UF
              </Label>
              <Input
                className="bg-black/40 border-white/10 h-10 text-white font-mono"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="SP"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                ID Externo
              </Label>
              <Input
                className="bg-black/40 border-white/10 h-10 text-white"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="ERP ID"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Contato (Telefone/Email)
            </Label>
            <Input
              className="bg-black/40 border-white/10 h-10 text-white"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Observações
            </Label>
            <Textarea
              className="bg-black/40 border-white/10 text-white min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas..."
            />
          </div>
        </div>
        <DialogFooter className="mt-4 border-t border-white/5 pt-4">
          <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={onClose}>
            CANCELAR
          </Button>
          <Button
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-white font-bold"
            onClick={() => mut.mutate()}
            disabled={!name || mut.isPending}
          >
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "SALVAR PROMOTOR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PromoterDeleteDialog({
  open,
  onClose,
  promoter,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  promoter: any;
  onSuccess?: () => void;
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
      toast.success(
        res.mode === "HARD"
          ? "Promotor excluído permanentemente."
          : "Promotor removido da listagem ativa.",
      );
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters-admin"] });
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters"] });
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir promotor."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-command-deep border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-500 font-black tracking-tighter uppercase">
            <AlertTriangle className="h-5 w-5" />
            Excluir Promotor
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Ação irreversível ou desativação de histórico.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-mk9-accent-primary/20" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              Analisando histórico operacional...
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="bg-white/5 border border-white/5 rounded-xl p-4 transition-all">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Agente
                  </p>
                  <p className="text-xs font-bold text-white">{promoter?.name}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Matrícula
                  </p>
                  <p className="text-xs font-mono text-slate-300">
                    {promoter?.employeeNumber || "—"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Região
                  </p>
                  <p className="text-xs text-slate-300">
                    {promoter?.uf || "—"} / {promoter?.city || "—"}
                  </p>
                </div>
              </div>
            </div>

            {impact && (impact.routes > 0 || impact.visits > 0) ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    Restrição de Exclusão
                  </p>
                </div>
                <p className="text-xs text-amber-400 opacity-80 leading-relaxed">
                  Este agente possui <strong>{impact.visits} visitas</strong> e{" "}
                  <strong>{impact.routes} roteiros</strong> registrados. Para manter a integridade
                  dos relatórios, ele será <strong>arquivado</strong> e removido da listagem ativa.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  Sem histórico vinculado. Exclusão física permitida.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 border-t border-white/5 pt-4">
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white"
            onClick={onClose}
            disabled={mut.isPending}
          >
            CANCELAR
          </Button>
          <Button
            className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-6 shadow-lg shadow-rose-500/20"
            onClick={() => mut.mutate()}
            disabled={isLoading || mut.isPending}
          >
            {mut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "CONFIRMAR EXCLUSÃO"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
