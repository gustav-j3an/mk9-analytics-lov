/**
 * MK9 — Diálogos administrativos de indústria (Etapas 1 e 2).
 *
 * A interface nunca decide sozinha: duplicidade, semelhança, concorrência e
 * permissão são sempre revalidadas no servidor. Aqui apenas coletamos os dados
 * e exibimos o retorno.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { INDUSTRY_ADMIN_CACHE_KEYS } from "@/lib/mk9-industries/admin";
import {
  mk9ArchiveIndustry,
  mk9CreateIndustry,
  mk9IndustryArchiveImpact,
  mk9ReactivateIndustry,
  mk9UpdateIndustry,
  mk9DeleteIndustry,
} from "@/lib/mk9-industries.functions";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

export type IndustryRow = {
  id: string;
  name: string;
  displayName?: string | null;
  notes?: string | null;
  requiresChecklist?: boolean;
  controlMode?: "VISIT_CONTROLLED" | "FIXED_OPERATION";
  archivedAt?: string | null;
  cnpj?: string | null;
  periodType?: string;
  startDay?: number | null;
  endDay?: number | null;
  usesPreviousMonth?: boolean;
  updatedAt: string;
};

function useInvalidateIndustries() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of INDUSTRY_ADMIN_CACHE_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };
}

function errorMessage(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : "";
  return msg && msg.length < 200 ? msg : fallback;
}

// ---------------------------------------------------------------------------
// Nova indústria
// ---------------------------------------------------------------------------
export function IndustryCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateIndustries();
  const createFn = useServerFn(mk9CreateIndustry);

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [notes, setNotes] = useState("");

  const [requiresChecklist, setRequiresChecklist] = useState(false);
  const [controlMode, setControlMode] = useState<"VISIT_CONTROLLED" | "FIXED_OPERATION">(
    "VISIT_CONTROLLED",
  );
  const [periodType, setPeriodType] = useState<"CALENDAR_MONTH" | "CUSTOM_CYCLE">("CALENDAR_MONTH");
  const [startDay, setStartDay] = useState("1");
  const [endDay, setEndDay] = useState("31");
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string }> | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDisplayName("");
      setCnpj("");
      setNotes("");
      setRequiresChecklist(false);
      setControlMode("VISIT_CONTROLLED");
      setPeriodType("CALENDAR_MONTH");
      setStartDay("1");
      setEndDay("31");
      setCandidates(null);
    }
  }, [open]);

  const mut = useMutation({
    mutationFn: (confirmed: boolean) =>
      createFn({
        data: {
          name,
          displayName: displayName || null,
          cnpj: cnpj || null,
          notes: notes || null,
          requiresChecklist,
          controlMode,
          periodType,
          startDay: periodType === "CUSTOM_CYCLE" ? Number(startDay) : null,
          endDay: periodType === "CUSTOM_CYCLE" ? Number(endDay) : null,
          confirmed,
        },
      }),
    onSuccess: (res: any) => {
      if (res?.status === "duplicate") {
        toast.error(`Já existe a indústria "${res.match?.name}".`);
        return;
      }
      if (res?.status === "candidates") {
        setCandidates(res.candidates ?? []);
        return;
      }
      toast.success("Indústria cadastrada.");
      invalidate();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível cadastrar a indústria.")),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-command-deep border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-mk9-accent-primary uppercase">
            Nova indústria
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Cadastro manual de indústria no Command Center.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="ind-name"
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
            >
              Nome *
            </Label>
            <Input
              id="ind-name"
              className="bg-black/40 border-white/10 h-10 text-white"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setCandidates(null);
              }}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="ind-display"
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
            >
              Nome complementar
            </Label>
            <Input
              id="ind-display"
              className="bg-black/40 border-white/10 h-10 text-white"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="ind-cnpj"
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
            >
              CNPJ
            </Label>
            <Input
              id="ind-cnpj"
              className="bg-black/40 border-white/10 h-10 text-white"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="ind-notes"
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
            >
              Observação operacional
            </Label>
            <Textarea
              id="ind-notes"
              className="bg-black/40 border-white/10 text-white min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.08]">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white uppercase tracking-tight">
                Exige checklist
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                Participa do fluxo de importação.
              </p>
            </div>
            <Switch checked={requiresChecklist} onCheckedChange={setRequiresChecklist} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Modelo de Controle
            </Label>
            <Select value={controlMode} onValueChange={(v) => setControlMode(v as any)}>
              <SelectTrigger className="bg-black/40 border-white/10 h-10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="VISIT_CONTROLLED">Monitorada (Dashboard/Analytics)</SelectItem>
                <SelectItem value="FIXED_OPERATION">Operação Fixa (Apenas Roteiro)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Tipo de período
            </Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
              <SelectTrigger className="bg-black/40 border-white/10 h-10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="CALENDAR_MONTH">Mês civil</SelectItem>
                <SelectItem value="CUSTOM_CYCLE">Período personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === "CUSTOM_CYCLE" && (
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              <div className="space-y-1.5">
                <Label
                  htmlFor="ind-start"
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
                >
                  Dia inicial
                </Label>
                <Input
                  id="ind-start"
                  type="number"
                  min={1}
                  max={31}
                  className="bg-black/40 border-white/10 h-10 text-white"
                  value={startDay}
                  onChange={(e) => setStartDay(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="ind-end"
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
                >
                  Dia final
                </Label>
                <Input
                  id="ind-end"
                  type="number"
                  min={1}
                  max={31}
                  className="bg-black/40 border-white/10 h-10 text-white"
                  value={endDay}
                  onChange={(e) => setEndDay(e.target.value)}
                />
              </div>
            </div>
          )}

          {candidates && candidates.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-500 animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <p className="font-bold uppercase tracking-widest">
                  Indústrias Semelhantes Encontradas
                </p>
              </div>
              <ul className="list-disc pl-5 space-y-1 opacity-80">
                {candidates.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
              <p className="mt-3 font-medium border-t border-amber-500/10 pt-2 opacity-70">
                Confirme apenas se realmente for uma nova entidade.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 border-t border-white/5 pt-4">
          <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={onClose}>
            CANCELAR
          </Button>
          <Button
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-white font-bold px-8 shadow-lg shadow-mk9-accent-primary/20"
            disabled={name.trim().length < 2 || mut.isPending}
            onClick={() => mut.mutate(Boolean(candidates))}
          >
            {mut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : candidates ? (
              "CRIAR MESMO ASSIM"
            ) : (
              "CRIAR INDÚSTRIA"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Editar indústria
// ---------------------------------------------------------------------------
export function IndustryEditDialog({
  industry,
  onClose,
}: {
  industry: IndustryRow | null;
  onClose: () => void;
}) {
  const invalidate = useInvalidateIndustries();
  const updateFn = useServerFn(mk9UpdateIndustry);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [notes, setNotes] = useState("");
  const [requiresChecklist, setRequiresChecklist] = useState(false);
  const [controlMode, setControlMode] = useState<"VISIT_CONTROLLED" | "FIXED_OPERATION">(
    "VISIT_CONTROLLED",
  );
  const [periodType, setPeriodType] = useState<"CALENDAR_MONTH" | "CUSTOM_CYCLE">("CALENDAR_MONTH");
  const [startDay, setStartDay] = useState("1");
  const [endDay, setEndDay] = useState("31");
  const [usesPreviousMonth, setUsesPreviousMonth] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (industry) {
      setName(industry.name ?? "");
      setDisplayName(industry.displayName ?? "");
      setCnpj(industry.cnpj ?? "");
      setNotes(industry.notes ?? "");
      setRequiresChecklist(industry.requiresChecklist === true);
      setControlMode(industry.controlMode ?? "VISIT_CONTROLLED");
      setPeriodType((industry.periodType as any) ?? "CALENDAR_MONTH");
      setStartDay(String(industry.startDay ?? "1"));
      setEndDay(String(industry.endDay ?? "31"));
      setUsesPreviousMonth(industry.usesPreviousMonth === true);
    }
  }, [industry]);

  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          industryId: industry!.id,
          expectedUpdatedAt: industry!.updatedAt,
          name,
          displayName: displayName || null,
          cnpj: cnpj || null,
          notes: notes || null,
          requiresChecklist,
          controlMode,
          periodType,
          startDay: periodType === "CUSTOM_CYCLE" ? Number(startDay) : null,
          endDay: periodType === "CUSTOM_CYCLE" ? Number(endDay) : null,
          usesPreviousMonth,
        },
      }),
    onSuccess: () => {
      toast.success("Cadastro atualizado.");
      invalidate();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível salvar o cadastro.")),
  });

  return (
    <Dialog open={!!industry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-command-deep border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-mk9-accent-primary uppercase">
            Editar indústria
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {industry?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="edit-name"
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
            >
              Nome *
            </Label>
            <Input
              id="edit-name"
              className="bg-black/40 border-white/10 h-10 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="edit-display"
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
            >
              Nome complementar
            </Label>
            <Input
              id="edit-display"
              className="bg-black/40 border-white/10 h-10 text-white"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="edit-cnpj"
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
            >
              CNPJ
            </Label>
            <Input
              id="edit-cnpj"
              className="bg-black/40 border-white/10 h-10 text-white"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="edit-notes"
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
            >
              Observação operacional
            </Label>
            <Textarea
              id="edit-notes"
              className="bg-black/40 border-white/10 text-white min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.08]">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white uppercase tracking-tight">
                Exige checklist
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                Controla a participação no fluxo.
              </p>
            </div>
            <Switch checked={requiresChecklist} onCheckedChange={setRequiresChecklist} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Modelo de Controle
            </Label>
            <Select value={controlMode} onValueChange={(v) => setControlMode(v as any)}>
              <SelectTrigger className="bg-black/40 border-white/10 h-10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="VISIT_CONTROLLED">Monitorada (Dashboard/Analytics)</SelectItem>
                <SelectItem value="FIXED_OPERATION">Operação Fixa (Apenas Roteiro)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Tipo de período
            </Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
              <SelectTrigger className="bg-black/40 border-white/10 h-10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-white/10">
                <SelectItem value="CALENDAR_MONTH">Mês civil</SelectItem>
                <SelectItem value="CUSTOM_CYCLE">Período personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === "CUSTOM_CYCLE" && (
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-start"
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
                >
                  Dia inicial
                </Label>
                <Input
                  id="edit-start"
                  type="number"
                  min={1}
                  max={31}
                  className="bg-black/40 border-white/10 h-10 text-white"
                  value={startDay}
                  onChange={(e) => setStartDay(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-end"
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"
                >
                  Dia final
                </Label>
                <Input
                  id="edit-end"
                  type="number"
                  min={1}
                  max={31}
                  className="bg-black/40 border-white/10 h-10 text-white"
                  value={endDay}
                  onChange={(e) => setEndDay(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
            <Switch checked={usesPreviousMonth} onCheckedChange={setUsesPreviousMonth} />
            <Label className="text-xs text-slate-300">Utilizar mês anterior como referência</Label>
          </div>
        </div>
        <DialogFooter className="mt-6 border-t border-white/5 pt-4 flex sm:justify-between items-center gap-4">
          <Button
            variant="ghost"
            className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            EXCLUIR
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={onClose}>
              CANCELAR
            </Button>
            <Button
              className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-white font-bold px-8"
              disabled={name.trim().length < 2 || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "SALVAR ALTERAÇÕES"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <IndustryDeleteDialog
        industry={deleteOpen ? industry : null}
        onClose={() => setDeleteOpen(false)}
        onSuccess={() => {
          setDeleteOpen(false);
          onClose();
        }}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Excluir indústria
// ---------------------------------------------------------------------------
export function IndustryDeleteDialog({
  industry,
  onClose,
  onSuccess,
}: {
  industry: IndustryRow | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const invalidate = useInvalidateIndustries();
  const deleteFn = useServerFn(mk9DeleteIndustry);
  const impactFn = useServerFn(mk9IndustryArchiveImpact);

  const impactQ = useQuery({
    queryKey: ["mk9-industry-delete-impact", industry?.id],
    queryFn: () => impactFn({ data: { industryId: industry!.id } }),
    enabled: !!industry,
  });

  const mut = useMutation({
    mutationFn: () => deleteFn({ data: { industryId: industry!.id } }),
    onSuccess: (res) => {
      if (res.status === "soft_deleted") {
        toast.info("Indústria possui histórico e foi desativada (exclusão segura).");
      } else {
        toast.success("Indústria excluída permanentemente.");
      }
      invalidate();
      onSuccess();
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível excluir a indústria.")),
  });

  const impact = impactQ.data;

  return (
    <Dialog open={!!industry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir indústria
          </DialogTitle>
          <DialogDescription>
            Confirmar exclusão de <strong>{industry?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive-foreground">
            <p className="font-semibold mb-2 text-destructive">Atenção:</p>
            <p>
              Se houver histórico operacional (visitas, roteiros ou checklists), a indústria será
              apenas <strong>desativada</strong> para preservar a integridade dos dados.
            </p>
          </div>

          <div className="space-y-2 border rounded-md p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CNPJ:</span>
              <span className="font-medium">{industry?.cnpj || "Não informado"}</span>
            </div>
            {impactQ.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" /> Analisando impacto...
              </div>
            ) : impact ? (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Checklists/Importações:</span>
                  <span className="font-medium text-amber-600">{impact.activeFrequencies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visitas registradas:</span>
                  <span className="font-medium text-amber-600">{impact.visits}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Confirmar Exclusão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Arquivar / Reativar
// ---------------------------------------------------------------------------
export function IndustryArchiveDialog({
  industry,
  onClose,
}: {
  industry: IndustryRow | null;
  onClose: () => void;
}) {
  const invalidate = useInvalidateIndustries();
  const archiveFn = useServerFn(mk9ArchiveIndustry);
  const impactFn = useServerFn(mk9IndustryArchiveImpact);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!industry) setReason("");
  }, [industry]);

  const impactQ = useQuery({
    queryKey: ["mk9-industry-archive-impact", industry?.id],
    queryFn: () => impactFn({ data: { industryId: industry!.id } }),
    enabled: !!industry,
  });

  const mut = useMutation({
    mutationFn: () =>
      archiveFn({
        data: {
          industryId: industry!.id,
          expectedUpdatedAt: industry!.updatedAt,
          reason: reason || null,
        },
      }),
    onSuccess: () => {
      toast.success("Indústria arquivada. Nenhum histórico foi apagado.");
      invalidate();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível arquivar a indústria.")),
  });

  const impact = impactQ.data;

  return (
    <Dialog open={!!industry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arquivar indústria</DialogTitle>
          <DialogDescription>{industry?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            A indústria deixa de aparecer nas operações ativas. Frequências, roteiros, visitas e
            histórico são preservados — nada é excluído.
          </p>
          <div className="rounded-md border p-3">
            <p className="mb-1 font-medium">Impacto atual</p>
            {impactQ.isLoading || !impact ? (
              <p className="text-muted-foreground">Calculando…</p>
            ) : (
              <ul className="space-y-0.5 text-muted-foreground">
                <li>
                  Frequências vigentes:{" "}
                  <span className="tabular-nums text-foreground">{impact.activeFrequencies}</span>
                </li>
                <li>
                  Roteiros ativos:{" "}
                  <span className="tabular-nums text-foreground">{impact.activeRoutes}</span>
                </li>
                <li>
                  Visitas registradas:{" "}
                  <span className="tabular-nums text-foreground">{impact.visits}</span>
                </li>
              </ul>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="archive-reason">Motivo (opcional)</Label>
            <Textarea
              id="archive-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={mut.isPending} onClick={() => mut.mutate()}>
            Arquivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IndustryReactivateDialog({
  industry,
  onClose,
}: {
  industry: IndustryRow | null;
  onClose: () => void;
}) {
  const invalidate = useInvalidateIndustries();
  const reactivateFn = useServerFn(mk9ReactivateIndustry);
  const mut = useMutation({
    mutationFn: () =>
      reactivateFn({ data: { industryId: industry!.id, expectedUpdatedAt: industry!.updatedAt } }),
    onSuccess: () => {
      toast.success("Indústria reativada. O checklist não foi religado automaticamente.");
      invalidate();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível reativar a indústria.")),
  });

  return (
    <Dialog open={!!industry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reativar indústria</DialogTitle>
          <DialogDescription>{industry?.name}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A indústria volta a aparecer nas operações ativas. A exigência de checklist permanece
          exatamente como estava — reativar não habilita checklist.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            Reativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
