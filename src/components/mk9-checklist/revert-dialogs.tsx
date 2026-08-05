import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  History, 
  RotateCcw, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2, 
  Calendar,
  Undo2,
  AlertCircle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  getChecklistRevertPreview, 
  revertChecklistImport, 
  correctChecklistCompetence 
} from "@/lib/mk9-checklist/revert.functions";


const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

interface RevertDialogProps {
  importId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RevertChecklistDialog({ importId, isOpen, onOpenChange, onSuccess }: RevertDialogProps) {
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const getPreviewFn = useServerFn(getChecklistRevertPreview);
  const revertFn = useServerFn(revertChecklistImport);

  const previewQ = useMutation({
    mutationFn: () => getPreviewFn({ data: { importId } }),
  });

  // Load preview when opening
  useState(() => {
    if (isOpen) previewQ.mutate();
  });

  const revertMut = useMutation({
    mutationFn: () => revertFn({ data: { importId, reason } }),
    onSuccess: () => {
      toast.success("Importação revertida com sucesso.");
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: any) => toast.error(`Falha ao reverter: ${e?.message ?? e}`),
  });

  const preview = previewQ.data;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <RotateCcw className="h-5 w-5" />
            Desfazer Importação
          </AlertDialogTitle>
          <AlertDialogDescription>
            {previewQ.isPending ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando impacto da reversão...
              </div>
            ) : preview ? (
              <div className="space-y-4 py-2">
                <p className="text-sm font-medium">
                  Você está prestes a remover os dados gerados pelo arquivo:
                  <br />
                  <span className="text-foreground">{preview.filename}</span>
                </p>

                <div className="rounded-md bg-muted/50 p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Visitas registradas:</span>
                    <span className="font-semibold">{preview.visitsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Versões de frequência:</span>
                    <span className="font-semibold">{preview.frequencyVersionsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lojas criadas:</span>
                    <span className="font-semibold text-amber-600">{preview.storesCreatedCount}</span>
                  </div>
                </div>

                {!preview.canRevert && (
                  <div className="flex gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-xs border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <p>{preview.blockReason || "Esta importação não pode ser revertida no estado atual."}</p>
                  </div>
                )}

                {preview.hasPosteriorImports && (
                  <div className="flex gap-2 p-3 bg-amber-50 text-amber-700 rounded-md text-xs border border-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <p>
                      Existem importações posteriores para este mesmo período e indústria. 
                      A reversão pode afetar a ordem cronológica do histórico.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium">Motivo da reversão (mín. 10 caracteres)</label>
                  <Textarea 
                    value={reason} 
                    onChange={e => setReason(e.target.value)}
                    placeholder="Ex: Arquivo enviado com dados incorretos..."
                    className="h-20"
                  />
                </div>
              </div>
            ) : (
              <p>Erro ao carregar dados da importação.</p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!preview?.canRevert || reason.length < 10 || revertMut.isPending}
            onClick={() => revertMut.mutate()}
          >
            {revertMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Confirmar Reversão
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CorrectCompetenceDialog({ importId, isOpen, onOpenChange, onSuccess }: RevertDialogProps) {
  const [reason, setReason] = useState("");
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  
  const qc = useQueryClient();
  const getPreviewFn = useServerFn(getChecklistRevertPreview);
  const correctFn = useServerFn(correctChecklistCompetence);

  const previewQ = useMutation({
    mutationFn: () => getPreviewFn({ data: { importId } }),
    onSuccess: (data) => {
      setMonth(data.operationMonth);
      setYear(data.operationYear);
    }
  });

  // Load preview when opening
  useState(() => {
    if (isOpen) previewQ.mutate();
  });

  const correctMut = useMutation({
    mutationFn: () => correctFn({ data: { importId, targetMonth: month, targetYear: year, reason } }),
    onSuccess: () => {
      toast.success("Competência corrigida e dados re-importados.");
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: any) => toast.error(`Falha ao corrigir: ${e?.message ?? e}`),
  });

  const preview = previewQ.data;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-primary">
            <Calendar className="h-5 w-5" />
            Corrigir Competência
          </AlertDialogTitle>
          <AlertDialogDescription>
            {previewQ.isPending ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando importação...
              </div>
            ) : preview ? (
              <div className="space-y-4 py-2">
                <p className="text-sm">
                  O sistema irá reverter a importação original e criar uma nova com os mesmos dados na competência selecionada.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Mês</label>
                    <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-semibold text-muted-foreground">Ano</label>
                    <Input 
                      type="number" 
                      value={year} 
                      onChange={e => setYear(Number(e.target.value))} 
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Justificativa (mín. 10 caracteres)</label>
                  <Textarea 
                    value={reason} 
                    onChange={e => setReason(e.target.value)}
                    placeholder="Ex: Competência selecionada errada no momento do envio..."
                    className="h-20"
                  />
                </div>

                <div className="flex gap-2 p-3 bg-blue-50 text-blue-700 rounded-md text-xs border border-blue-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>
                    As visitas e frequências serão recalculadas automaticamente para o novo período.
                  </p>
                </div>
              </div>
            ) : (
              <p>Erro ao carregar dados.</p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancelar</AlertDialogCancel>
          <Button
            disabled={!preview?.canRevert || reason.length < 10 || correctMut.isPending}
            onClick={() => correctMut.mutate()}
          >
            {correctMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Re-importar na nova competência
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CompetenceConflictDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  error: any;
  onConfirm: (targetMonth: number, targetYear: number) => void;
}

export function CompetenceConflictDialog({ isOpen, onOpenChange, error, onConfirm }: CompetenceConflictDialogProps) {
  const extra = error?.extra || {};
  const errorCode = extra.errorCode || "COMPETENCE_CONFLICT";
  const fileCompetence = extra.fileCompetence;
  const selectedCompetence = extra.selectedCompetence;
  const [fileYear, fileMonth] = (extra.firstDate || "").split("-").map(Number);

  const isConflict = errorCode === "COMPETENCE_CONFLICT";

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className={cn("flex items-center gap-2", isConflict ? "text-amber-600" : "text-blue-600")}>
            {isConflict ? <AlertTriangle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            {isConflict ? "Conflito de Competência" : "Competência precisa de revisão"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-2">
            <div className={cn("rounded-md p-3 border text-sm", isConflict ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-blue-50 border-blue-200 text-blue-800")}>
              <p className="font-semibold">{isConflict ? "Atenção!" : "Informação do Período"}</p>
              <div className="mt-2 space-y-1">
                <p>Esperado: <strong>{selectedCompetence}</strong></p>
                <p>Janela real: <strong>{extra.windowStart ? extra.windowStart.split("-").reverse().join("/") : ""} a {extra.windowEnd ? extra.windowEnd.split("-").reverse().join("/") : ""}</strong></p>
                <div className="pt-1 flex gap-4">
                  <span>Datas dentro: <strong>{extra.datesInside}</strong></span>
                  <span>Datas fora: <strong>{extra.datesOutside}</strong></span>
                </div>
              </div>
            </div>

            {isConflict ? (
              <p className="text-sm">
                O arquivo parece pertencer a <strong>{fileCompetence}</strong>. 
                Deseja corrigir a seleção e prosseguir?
              </p>
            ) : (
              <p className="text-sm">
                Existem datas fora do período operacional esperado, mas a maioria pertence a <strong>{selectedCompetence}</strong>.
                Deseja prosseguir mesmo assim?
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {isConflict ? (
            <AlertDialogAction 
              onClick={() => onConfirm(fileMonth, fileYear)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Corrigir para {fileCompetence}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction 
              onClick={() => onConfirm(Number(selectedCompetence.split("/")[0]), Number(selectedCompetence.split("/")[1]))}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Manter {selectedCompetence}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
