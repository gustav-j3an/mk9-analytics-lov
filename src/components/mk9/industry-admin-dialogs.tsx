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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { INDUSTRY_ADMIN_CACHE_KEYS } from "@/lib/mk9-industries/admin";
import {
  mk9ArchiveIndustry,
  mk9CreateIndustry,
  mk9IndustryArchiveImpact,
  mk9ReactivateIndustry,
  mk9UpdateIndustry,
} from "@/lib/mk9-industries.functions";

export type IndustryRow = {
  id: string;
  name: string;
  displayName?: string | null;
  notes?: string | null;
  requiresChecklist?: boolean;
  archivedAt?: string | null;
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
  const [notes, setNotes] = useState("");
  const [requiresChecklist, setRequiresChecklist] = useState(false);
  const [periodType, setPeriodType] = useState<"CALENDAR_MONTH" | "CUSTOM_CYCLE">("CALENDAR_MONTH");
  const [startDay, setStartDay] = useState("1");
  const [endDay, setEndDay] = useState("31");
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string }> | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDisplayName("");
      setNotes("");
      setRequiresChecklist(false);
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
          notes: notes || null,
          requiresChecklist,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova indústria</DialogTitle>
          <DialogDescription>Cadastro manual — origem registrada como MANUAL.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ind-name">Nome *</Label>
            <Input id="ind-name" value={name} onChange={(e) => { setName(e.target.value); setCandidates(null); }} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ind-display">Nome complementar</Label>
            <Input id="ind-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ind-notes">Observação operacional</Label>
            <Textarea id="ind-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Exige checklist</p>
              <p className="text-xs text-muted-foreground">Participa do fluxo de importação de checklist.</p>
            </div>
            <Switch checked={requiresChecklist} onCheckedChange={setRequiresChecklist} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de período</Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CALENDAR_MONTH">Mês civil</SelectItem>
                <SelectItem value="CUSTOM_CYCLE">Período personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === "CUSTOM_CYCLE" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ind-start">Dia inicial</Label>
                <Input id="ind-start" type="number" min={1} max={31} value={startDay} onChange={(e) => setStartDay(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ind-end">Dia final</Label>
                <Input id="ind-end" type="number" min={1} max={31} value={endDay} onChange={(e) => setEndDay(e.target.value)} />
              </div>
            </div>
          )}

          {candidates && candidates.length > 0 && (
            <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
              <p className="font-medium">Existem indústrias com nome parecido:</p>
              <ul className="mt-1 list-disc pl-5">
                {candidates.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
              <p className="mt-2">Confirme apenas se realmente for uma indústria diferente.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={name.trim().length < 2 || mut.isPending}
            onClick={() => mut.mutate(Boolean(candidates))}
          >
            {candidates ? "Criar mesmo assim" : "Criar indústria"}
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
  const [notes, setNotes] = useState("");
  const [requiresChecklist, setRequiresChecklist] = useState(false);

  useEffect(() => {
    if (industry) {
      setName(industry.name ?? "");
      setDisplayName(industry.displayName ?? "");
      setNotes(industry.notes ?? "");
      setRequiresChecklist(industry.requiresChecklist === true);
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
          notes: notes || null,
          requiresChecklist,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar indústria</DialogTitle>
          <DialogDescription>{industry?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nome *</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-display">Nome complementar</Label>
            <Input id="edit-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Observação operacional</Label>
            <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Exige checklist</p>
              <p className="text-xs text-muted-foreground">Controla a participação no fluxo de checklist.</p>
            </div>
            <Switch checked={requiresChecklist} onCheckedChange={setRequiresChecklist} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={name.trim().length < 2 || mut.isPending} onClick={() => mut.mutate()}>
            Salvar
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
        data: { industryId: industry!.id, expectedUpdatedAt: industry!.updatedAt, reason: reason || null },
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
                <li>Frequências vigentes: <span className="tabular-nums text-foreground">{impact.activeFrequencies}</span></li>
                <li>Roteiros ativos: <span className="tabular-nums text-foreground">{impact.activeRoutes}</span></li>
                <li>Visitas registradas: <span className="tabular-nums text-foreground">{impact.visits}</span></li>
              </ul>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="archive-reason">Motivo (opcional)</Label>
            <Textarea id="archive-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
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
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>Reativar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
