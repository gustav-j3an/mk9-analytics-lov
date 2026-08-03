import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  Trash2,
  ClipboardCheck,
  XCircle,
  Files,
  X,
  FileText,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileSearch,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { checklistBatchPreview } from "@/lib/mk9-checklist-batch.functions";
import { checklistBatchCommit } from "@/lib/mk9-checklist-batch-commit.functions";
import type { ChecklistBatchFile } from "@/lib/mk9-checklist/batch-types";



import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { toast } from "sonner";
import {
  checklistCommit,
  checklistList,
  checklistDelete,
  checklistCancel,
  checklistReprocessValidation,
  checklistGetValidation,
} from "@/lib/mk9-checklist.functions";
import {
  mk9CreateChecklistIndustry,
  mk9ListChecklistIndustries,
  mk9SetIndustryRequiresChecklist,
} from "@/lib/mk9-data.functions";
import { useMk9Session } from "@/lib/mk9-auth/session";
import {
  INDUSTRY_CHECKLIST_DISABLED,
  canManageChecklistIndustries,
  NON_ADMIN_DISABLED_MESSAGE,
  MISSING_PERIOD_WARNING,
  CHECKLIST_INDUSTRY_CACHE_KEYS,
} from "@/lib/mk9-checklist/industry-admin-ui";
import { detectMk9FileKind } from "@/lib/mk9/detect-file-kind";
import type { ChecklistPreview } from "@/lib/mk9-checklist/types";


const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  previewing: { label: "Prévia gerada", variant: "secondary" },
  committing: { label: "Processando", variant: "secondary" },
  done: { label: "Concluído", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

const VALIDATION_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  CONSISTENT: { label: "Auditoria OK", variant: "default" },
  COMPLETED_WITH_ALERTS: { label: "Concluído com alertas", variant: "secondary" },
  INCONSISTENT: { label: "INCONSISTENTE", variant: "destructive" },
  FAILED: { label: "Auditoria falhou", variant: "destructive" },
};

function shortDate(value: string) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return d && m && y ? `${d}/${m}/${y}` : value;
}

type RichError = {
  __mk9Error?: true;
  step?: string;
  function?: string;
  message?: string;
  name?: string;
  stack?: string;
  file?: string;
  line?: number;
  validation?: { field: string; expected?: string; received?: unknown; issues: any[] };
  database?: {
    code?: string; message?: string; details?: string; hint?: string;
    constraint?: string; table?: string; column?: string; value?: unknown;
  };
  parser?: { sheet?: string; row?: number; column?: string | number; value?: unknown };
  extra?: Record<string, unknown>;
  raw?: string;
};

type ChecklistDebugEvent = {
  at: string;
  level: "info" | "error";
  step: string;
  message: string;
  data?: Record<string, unknown>;
};

type ChecklistPreviewResponse = {
  importId: string;
  preview: ChecklistPreview;
  diagnostics?: ChecklistDebugEvent[];
};

function parseServerError(e: any): RichError {
  const raw = e?.message ?? String(e ?? "");
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.__mk9Error) return parsed as RichError;
  } catch {}
  const code = e?.code ?? e?.name;
  return { message: raw || "Erro desconhecido", raw, ...(code ? { code } : {}) } as RichError;
}

async function requestChecklistPreview(input: {
  file: File;
  industryId: string;
  operationMonth: number;
  operationYear: number;
}): Promise<ChecklistPreviewResponse> {
  const form = new FormData();
  form.append("file", input.file, input.file.name);
  form.append("industryId", input.industryId);
  form.append("operationMonth", String(input.operationMonth));
  form.append("operationYear", String(input.operationYear));

  const { mk9AuthHeaders } = await import("@/lib/mk9-auth/fetch-headers");
  const response = await fetch("/api/checklists/preview", {
    method: "POST",
    headers: await mk9AuthHeaders(),
    body: form,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const err = payload?.error ?? {
      __mk9Error: true,
      step: "http-response",
      function: "requestChecklistPreview",
      message: `HTTP ${response.status}: ${response.statusText}`,
      extra: { diagnostics: payload?.diagnostics ?? [] },
    };
    throw new Error(JSON.stringify(err));
  }
  return payload as ChecklistPreviewResponse;
}

export function Mk9ChecklistImportModule({ onSwitchToBase }: { onSwitchToBase?: () => void } = {}) {
  const [viewMode, setViewMode] = useState<"individual" | "batch">("batch");
  
  // Estados para importação individual
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [industryId, setIndustryId] = useState<string>("");
  const [preview, setPreview] = useState<ChecklistPreview | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "found" | "linked_by_similarity" | "new_store" | "invalid_date">("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ackNewStores, setAckNewStores] = useState(false);
  const [lastError, setLastError] = useState<RichError | null>(null);
  const [rejected, setRejected] = useState<{ reason: string; sheets: string[] } | null>(null);
  const [highlightAck, setHighlightAck] = useState(false);
  const [phase, setPhase] = useState<"idle" | "confirming" | "stores" | "visits" | "reconcile" | "done" | "failed">("idle");
  const [gate, setGate] = useState<{ industryId: string; industryName: string } | null>(null);
  const [newIndustryName, setNewIndustryName] = useState("");
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string }> | null>(null);

  const phaseTimersRef = useRef<number[]>([]);
  const ackRef = useRef<HTMLLabelElement | null>(null);
  const { roles } = useMk9Session();
  const isAdmin = canManageChecklistIndustries(roles);


  const commitFn = useServerFn(checklistCommit);
  const listFn = useServerFn(checklistList);
  const deleteFn = useServerFn(checklistDelete);
  const cancelFn = useServerFn(checklistCancel);
  const industriesFn = useServerFn(mk9ListChecklistIndustries);
  const enableIndustryFn = useServerFn(mk9SetIndustryRequiresChecklist);
  const createIndustryFn = useServerFn(mk9CreateChecklistIndustry);
  const qc = useQueryClient();

  const clearPhaseTimers = () => {
    for (const t of phaseTimersRef.current) window.clearTimeout(t);
    phaseTimersRef.current = [];
  };
  useEffect(() => () => clearPhaseTimers(), []);


  const industriesQ = useQuery({ queryKey: ["mk9-checklist-industries"], queryFn: () => industriesFn() });
  const historyQ = useQuery({ queryKey: ["mk9-checklist-imports"], queryFn: () => listFn() });

  const previewMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione a planilha do checklist");
      if (!industryId) throw new Error("Selecione a indústria");
      return requestChecklistPreview({
        file,
        industryId,
        operationMonth: month,
        operationYear: year,
      });
    },
    onMutate: () => {
      setAckNewStores(false);
      setConfirmOpen(false);
      setHighlightAck(false);
    },
    onSuccess: (res: ChecklistPreviewResponse) => {
      setPreview(res.preview);
      setImportId(res.importId);
      setLastError(null);
      toast.success("Prévia gerada");
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
    },
    onError: (e: any) => {
      const rich = parseServerError(e);
      // Indústria não habilitada: ADMIN pode habilitar e continuar sem reenviar o arquivo.
      if ((rich as any).code === INDUSTRY_CHECKLIST_DISABLED) {
        const name =
          (industriesQ.data ?? []).find((i) => i.id === industryId)?.name ?? "Indústria selecionada";
        if (isAdmin) {
          setGate({ industryId: (rich as any).industryId ?? industryId, industryName: name });
          return;
        }
        toast.error(NON_ADMIN_DISABLED_MESSAGE, { duration: 10000 });
        return;
      }
      setLastError(rich);
      toast.error(rich.message ?? "Falha ao gerar prévia", { duration: 10000 });
    },
  });

  const invalidateChecklistCaches = () => {
    for (const key of CHECKLIST_INDUSTRY_CACHE_KEYS) qc.invalidateQueries({ queryKey: [key] });
  };

  // "Habilitar e continuar": habilita no servidor (ADMIN revalidado lá) e retoma
  // a prévia com o MESMO arquivo já selecionado — sem novo upload.
  const enableAndContinueMut = useMutation({
    mutationFn: async () => {
      if (!gate) throw new Error("Nenhuma indústria pendente");
      await enableIndustryFn({
        data: { industryId: gate.industryId, value: true, source: "IMPORT" as const },
      });
      return gate.industryId;
    },
    onSuccess: (id: string) => {
      invalidateChecklistCaches();
      setGate(null);
      setIndustryId(id);
      toast.success("Indústria habilitada para checklist", { description: MISSING_PERIOD_WARNING });
      previewMut.mutate();
    },
    onError: (e: any) => toast.error(parseServerError(e).message ?? "Falha ao habilitar indústria"),
  });

  // Indústria inexistente: cadastro explícito, com candidatos semelhantes antes de criar.
  const createIndustryMut = useMutation({
    mutationFn: async (confirmed: boolean) =>
      createIndustryFn({
        data: { name: newIndustryName, confirmed, importId: importId ?? null },
      }),
    onSuccess: (res: any) => {
      if (res.status === "candidates") {
        setCandidates(res.candidates);
        toast.warning("Existem indústrias com nome parecido. Confirme antes de cadastrar.");
        return;
      }
      if (res.status === "duplicate") {
        toast.error("Já existe uma indústria cadastrada com este nome.");
        setIndustryId(res.match.id);
        setCandidates(null);
        return;
      }
      invalidateChecklistCaches();
      setCandidates(null);
      setNewIndustryName("");
      setIndustryId(res.industry.id);
      toast.success("Indústria cadastrada e habilitada para checklist", {
        description: MISSING_PERIOD_WARNING,
      });
      if (file) previewMut.mutate();
    },
    onError: (e: any) => toast.error(parseServerError(e).message ?? "Falha ao cadastrar indústria"),
  });

  const commitMut = useMutation({
    mutationFn: async () => {
      if (!preview || !importId) throw new Error("Gere a prévia antes");
      const items = preview.items
        .filter(
          (i) =>
            (i.status === "found" || i.status === "linked_by_similarity" || i.status === "new_store") &&
            i.scheduledDate,
        )
        .map((i) => ({
          storeId: i.storeId,
          storeName: i.storeName,
          storeNormalized: i.storeNormalized,
          uf: i.uf,
          scheduledDate: i.scheduledDate,
          isNew: i.status === "new_store",
        }));
      if (!items.length) throw new Error("Nenhuma visita válida para importar");
      // Fases visuais (client-side): não refletem o servidor 1:1, mas dão feedback claro.
      clearPhaseTimers();
      setPhase("confirming");
      phaseTimersRef.current.push(
        window.setTimeout(() => setPhase("stores"), 400),
        window.setTimeout(() => setPhase("visits"), 1500),
        window.setTimeout(() => setPhase("reconcile"), 3000),
      );
      return commitFn({
        data: {
          importId,
          industryId: preview.industryId,
          operationMonth: preview.operationMonth,
          operationYear: preview.operationYear,
          items,
        },
      });
    },
    onSuccess: (res: any) => {
      clearPhaseTimers();
      setPhase("done");
      setLastError(null);
      toast.success("Checklist importado", {
        description: `${res.persisted} novas · ${res.skipped} já existentes · ${res.storesCreated ?? 0} lojas criadas · ${res.storesReused ?? 0} lojas reaproveitadas`,
        duration: 8000,
      });
      setPreview(null);
      setImportId(null);
      setFile(null);
      setAckNewStores(false);
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
      window.setTimeout(() => setPhase("idle"), 1200);
    },
    onError: (e: any) => {
      clearPhaseTimers();
      setPhase("failed");
      const rich = parseServerError(e);
      setLastError(rich);
      toast.error(rich.message ?? "Falha ao confirmar", { duration: 10000 });
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
      window.setTimeout(() => setPhase("idle"), 1500);
    },
  });


  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { importId: id } }),
    onSuccess: () => {
      toast.success("Importação removida");
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  const discardMut = useMutation({
    mutationFn: async () => {
      if (importId) await cancelFn({ data: { importId } });
    },
    onSuccess: () => {
      toast.success("Prévia descartada");
      setPreview(null);
      setImportId(null);
      setAckNewStores(false);
      setLastError(null);
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao descartar prévia"),
  });

  const items = preview?.items ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.status === filter)),
    [items, filter],
  );

  const validItems = items.filter(
    (i) =>
      (i.status === "found" || i.status === "linked_by_similarity" || i.status === "new_store") &&
      Boolean(i.scheduledDate),
  ).length;
  const newStoresCount = Number(preview?.counters.storesNew ?? 0);
  const canConfirm =
    preview != null &&
    validItems > 0 &&
    !previewMut.isPending &&
    !commitMut.isPending &&
    (newStoresCount === 0 || ackNewStores);

  const periodLabel = useMemo(() => {
    if (!items.length) return null;
    const dates = items.map((i) => i.scheduledDate).filter(Boolean).sort();
    if (!dates.length) return null;
    return `${shortDate(dates[0])} a ${shortDate(dates[dates.length - 1])}`;
  }, [items]);

  const flashAck = () => {
    setHighlightAck(true);
    ackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightAck(false), 1600);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button 
          variant={viewMode === "individual" ? "default" : "outline"} 
          onClick={() => setViewMode("individual")}
          size="sm"
        >
          Importação individual
        </Button>
        <Button 
          variant={viewMode === "batch" ? "default" : "outline"} 
          onClick={() => setViewMode("batch")}
          size="sm"
        >
          publicar atualizações em lote
        </Button>
      </div>

      {viewMode === "individual" ? (
        <IndividualImport 
          onSwitchToBase={onSwitchToBase} 
          now={now}
          industriesQ={industriesQ}
          historyQ={historyQ}
          isAdmin={isAdmin}
          previewMut={previewMut}
          commitMut={commitMut}
          deleteMut={deleteMut}
          discardMut={discardMut}
          enableAndContinueMut={enableAndContinueMut}
          createIndustryMut={createIndustryMut}
          file={file} setFile={setFile}
          month={month} setMonth={setMonth}
          year={year} setYear={setYear}
          industryId={industryId} setIndustryId={setIndustryId}
          preview={preview} setPreview={setPreview}
          importId={importId} setImportId={setImportId}
          filter={filter} setFilter={setFilter}
          confirmOpen={confirmOpen} setConfirmOpen={setConfirmOpen}
          ackNewStores={ackNewStores} setAckNewStores={setAckNewStores}
          lastError={lastError} setLastError={setLastError}
          rejected={rejected} setRejected={setRejected}
          highlightAck={highlightAck} setHighlightAck={setHighlightAck}
          phase={phase} setPhase={setPhase}
          gate={gate} setGate={setGate}
          newIndustryName={newIndustryName} setNewIndustryName={setNewIndustryName}
          candidates={candidates} setCandidates={setCandidates}
          ackRef={ackRef}
          flashAck={flashAck}
          validItems={validItems}
          newStoresCount={newStoresCount}
          canConfirm={canConfirm}
          periodLabel={periodLabel}
          filtered={filtered}
        />
      ) : (
        <Mk9ChecklistBatchModule industries={industriesQ.data ?? []} />
      )}
    </div>
  );
}

function Mk9ChecklistBatchModule({ industries }: { industries: any[] }) {
  const [files, setFiles] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const qc = useQueryClient();

  const previewMut = useServerFn(checklistBatchPreview);
  const commitBatchFn = useServerFn(checklistBatchCommit);


  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: ChecklistBatchFile[] = acceptedFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      filename: f.name,
      status: "PENDING",
      operationMonth: month,
      operationYear: year,
      warnings: [],
      rawFile: f,
    } as any));
    setFiles(prev => [...prev, ...newFiles]);
  }, [month, year]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    }
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const startAnalysis = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    
    console.log("[BATCH ANALYZE START]", { count: files.length });

    // Atualiza todos para QUEUED
    setFiles(prev => prev.map(f => 
      f.status === "PENDING" ? { ...f, status: "QUEUED" } : f
    ) as any);

    // Processa com concorrência limitada (máx 3)
    const BATCH_SIZE = 3;
    const pending = [...files.filter(f => f.status === "PENDING" || f.status === "QUEUED")];
    
    const processFile = async (f: any) => {
      const targetId = f.id;
      
      const updateFileStatus = (status: string, extra = {}) => {
        setFiles(current => current.map(file => 
          file.id === targetId ? { ...file, status, ...extra } : file
        ) as any);
      };

      try {
        console.log(`[BATCH FILE START] ${f.filename}`);
        updateFileStatus("UPLOADING");

        // Detecção de indústria pelo nome do arquivo no cliente (otimização)
        const filenameLower = f.filename.toLowerCase();
        const matchedIndustry = (industries || []).find((i: any) => 
          filenameLower.includes(i.name.toLowerCase())
        );

        if (!matchedIndustry) {
          console.log(`[BATCH FILE NEEDS_REVIEW] ${f.filename} - Indústria não identificada`);
          updateFileStatus("NEEDS_REVIEW", {
            message: "Indústria não identificada pelo nome do arquivo. Selecione manualmente."
          });
          return;
        }

        console.log(`[BATCH FILE FORM DATA CREATED] ${f.filename}`);
        const formData = new FormData();
        formData.append("file", f.rawFile);
        formData.append("industryId", matchedIndustry.id);
        formData.append("operationMonth", String(month));
        formData.append("operationYear", String(year));
        if (batchId) formData.append("batchId", batchId);

        console.log(`[BATCH FILE REQUEST START] ${f.filename} -> /api/checklists/preview`);
        
        const { mk9AuthHeaders } = await import("@/lib/mk9-auth/fetch-headers");
        const response = await fetch("/api/checklists/preview", {
          method: "POST",
          headers: await mk9AuthHeaders(),
          body: formData,
        });

        console.log(`[BATCH FILE RESPONSE] ${f.filename} -> ${response.status}`);
        
        const contentType = response.headers.get("content-type");
        let result: any;
        
        if (contentType?.includes("application/json")) {
          result = await response.json();
        } else {
          const text = await response.text();
          console.error(`[BATCH FILE ERROR] Resposta não-JSON: ${text.slice(0, 100)}`);
          throw new Error(`Resposta inválida do servidor (HTTP ${response.status}).`);
        }

        if (!response.ok) {
          const richError = result.error || {
            message: result.message || `Erro ${response.status}`,
            code: response.status
          };
          
          if (response.status === 401) throw new Error("Sessão expirada. Faça login novamente.");
          if (response.status === 403) throw new Error("Usuário sem permissão para importar checklists.");
          
          throw new Error(`Falha na análise (${richError.code || response.status}): ${richError.message}`);
        }

        console.log(`[BATCH FILE PREVIEW SUCCESS] ${f.filename}`);
        updateFileStatus("READY", {
          id: result.importId || targetId,
          industryId: matchedIndustry.id,
          industryName: matchedIndustry.name,
          preview: result.preview,
          message: result.message
        });

      } catch (e: any) {
        console.error(`[BATCH FILE ERROR] ${f.filename}`, e);
        const rich = parseServerError(e);
        updateFileStatus("ERROR", { 
          error: rich.message || "Falha técnica ao processar arquivo."
        });
      }
    };

    // Executa em pequenos blocos para não sobrecarregar
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const chunk = pending.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(chunk.map(f => processFile(f)));
    }

    console.log("[BATCH ANALYZE END]");
    setAnalyzing(false);
    qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
  };

  const runBatchImport = async () => {
    if (readyToImport.length === 0) return;
    setCommitting(true);
    try {
      const res = await commitBatchFn({
        data: {
          batchId: batchId || "00000000-0000-0000-0000-000000000000",
          importIds: readyToImport.map(f => f.id),
        }
      });

      setFiles(prev => prev.map(f => {
        const found = res.results.find((r: any) => r.importId === f.id);
        if (found) {
          return {
            ...f,
            status: found.status === "SUCCESS" ? "IMPORTED" : "FAILED",
            error: found.error,
          } as any;
        }
        return f;
      }));

      toast.success("Processamento de lote finalizado");
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
    } catch (e: any) {
      toast.error("Falha ao importar lote: " + (e?.message ?? String(e)));
    } finally {
      setCommitting(false);
    }
  };


  const readyToImport = files.filter(f => f.status === "READY");

  return (
    <div className="space-y-4">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Files className="h-5 w-5" />
            Importação em lote (máx. 30 arquivos)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Mês de competência</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Ano</label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min={2024} max={2100} />
            </div>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium">
              Arraste os checklists aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Suporta múltiplos arquivos .xlsx ou .xls
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Arquivos no lote ({files.length})</h4>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setFiles([])} disabled={analyzing}>
                    Limpar tudo
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={startAnalysis} 
                    disabled={analyzing || files.every(f => f.status !== "PENDING" && f.status !== "ERROR")}
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Analisando {files.filter(f => ["UPLOADING", "ANALYZING", "READY", "ERROR", "NEEDS_REVIEW"].includes(f.status)).length} de {files.length}
                      </>
                    ) : (
                      <>
                        <FileSearch className="h-4 w-4 mr-2" />
                        Analisar arquivos
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2">
                {files.map((file) => (
                  <BatchFileRow key={file.id} file={file} onRemove={() => removeFile(file.id)} setFiles={setFiles} />
                ))}
              </div>
            </div>
          )}

          {readyToImport.length > 0 && (
            <div className="pt-4 border-t flex justify-end">
              <Button size="lg" onClick={runBatchImport} disabled={committing} className="bg-emerald-600 hover:bg-emerald-700">
                {committing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Importar {readyToImport.length} arquivos prontos
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

function BatchFileRow({ file, onRemove, setFiles }: { file: any; onRemove: () => void; setFiles: any }) {
  const [expanded, setOpen] = useState(false);
  
  const statusConfig: Record<string, { icon: any, color: string, label: string }> = {
    PENDING: { icon: Clock, color: "text-muted-foreground", label: "Aguardando análise" },
    QUEUED: { icon: Clock, color: "text-blue-400 animate-pulse", label: "Na fila" },
    UPLOADING: { icon: Upload, color: "text-blue-500 animate-bounce", label: "Enviando..." },
    ANALYZING: { icon: Loader2, color: "text-primary animate-spin", label: "Analisando..." },
    READY: { icon: CheckCircle2, color: "text-emerald-500", label: "Pronto" },
    NEEDS_REVIEW: { icon: AlertCircle, color: "text-amber-500", label: "Revisão necessária" },
    ERROR: { icon: XCircle, color: "text-destructive", label: "Erro" },
    IMPORTED: { icon: Check, color: "text-emerald-500", label: "Importado" },
  };

  const cfg = statusConfig[file.status] || statusConfig.PENDING;
  const Icon = cfg.icon;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-3 flex items-center gap-3">
        <Icon className={cn("h-5 w-5 shrink-0", cfg.color)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" title={file.filename}>{file.filename}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-[10px] font-bold uppercase", cfg.color)}>{cfg.label}</span>
            {file.industryName && (
              <span className="text-[10px] text-muted-foreground underline">Indústria: {file.industryName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {file.status === "ERROR" && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setFiles((prev: any) => prev.map((f: any) => f.id === file.id ? { ...f, status: "PENDING" } : f));
              }}
              title="Tentar novamente"
            >
              <Clock className="h-4 w-4 text-primary" />
            </Button>
          )}
          {file.preview && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(!expanded)}>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRemove} disabled={file.status === "ANALYZING" || file.status === "UPLOADING"}>
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      {expanded && file.preview && (
        <div className="px-3 pb-3 bg-muted/20 border-t pt-2">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="bg-background p-1.5 rounded border">
              <p className="text-muted-foreground uppercase font-bold tracking-tighter">Visitas</p>
              <p className="text-lg font-semibold">{file.preview.counters.totalMarks}</p>
            </div>
            <div className="bg-background p-1.5 rounded border">
              <p className="text-muted-foreground uppercase font-bold tracking-tighter">Lojas</p>
              <p className="text-lg font-semibold">{file.preview.counters.totalStores}</p>
            </div>
            <div className="bg-background p-1.5 rounded border">
              <p className="text-muted-foreground uppercase font-bold tracking-tighter">Divergências</p>
              <p className="text-lg font-semibold text-amber-600">{file.preview.counters.storesNotFound + (file.preview.counters.duplicateStoreNames || 0)}</p>
            </div>
          </div>
          {file.error && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Detalhes do erro:</p>
              <div className="text-[11px] text-destructive font-mono bg-destructive/5 p-2 rounded border border-destructive/20 whitespace-pre-wrap">
                {file.error}
              </div>
            </div>
          )}
          {file.status === "NEEDS_REVIEW" && (
            <p className="text-xs text-amber-600 mt-2 italic">{file.message || "Verifique se o nome do arquivo contém o nome da indústria."}</p>
          )}
        </div>
      )}
    </div>
  );
}


function IndividualImport({ 
  onSwitchToBase, now, industriesQ, historyQ, isAdmin, previewMut, commitMut, deleteMut, discardMut,
  enableAndContinueMut, createIndustryMut, file, setFile, month, setMonth, year, setYear,
  industryId, setIndustryId, preview, setPreview, importId, setImportId, filter, setFilter,
  confirmOpen, setConfirmOpen, ackNewStores, setAckNewStores, lastError, setLastError,
  rejected, setRejected, highlightAck, setHighlightAck, phase, setPhase, gate, setGate,
  newIndustryName, setNewIndustryName, candidates, setCandidates, ackRef, flashAck,
  validItems, newStoresCount, canConfirm, periodLabel, filtered
}: any) {
  return (
    <div className="space-y-6">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Importar checklist mensal
          </CardTitle>
        </CardHeader>


        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Arquivo .xlsx (checklist mensal da indústria)</label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={async (e: any) => {

                  const f = e.target.files?.[0] ?? null;
                  setPreview(null);
                  setImportId(null);
                  setLastError(null);
                  setRejected(null);
                  setAckNewStores(false);
                  if (!f) { setFile(null); return; }
                  const det = await detectMk9FileKind(f);
                  if (det.kind === "base") {
                    setFile(null);
                    setRejected({
                      reason: det.reason,
                      sheets: det.sheets,
                    });
                    e.target.value = "";
                    return;
                  }
                  setFile(f);
                }}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Mês</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Ano</label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min={2024} max={2100} />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Indústria</label>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger>
                <SelectValue placeholder={industriesQ.isLoading ? "Carregando…" : "Selecione a indústria"} />
              </SelectTrigger>
              <SelectContent>
                {(industriesQ.data ?? []).map((i: any) => (

                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                A indústria do arquivo não está cadastrada? Cadastre-a aqui — ela nasce habilitada
                para checklist, com registro de quem cadastrou.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Nome da indústria"
                  value={newIndustryName}
                  onChange={(e) => {
                    setNewIndustryName(e.target.value);
                    setCandidates(null);
                  }}
                />
                <Button
                  variant="outline"
                  disabled={newIndustryName.trim().length < 2 || createIndustryMut.isPending}
                  onClick={() => createIndustryMut.mutate(!!candidates)}
                >
                  {createIndustryMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {candidates ? "Cadastrar mesmo assim" : "Cadastrar indústria"}
                </Button>
              </div>
              {candidates && (
                <div className="space-y-1 text-xs">
                  <p className="text-amber-500">Indústrias semelhantes já cadastradas:</p>
                  {candidates.map((c: any) => (

                    <button
                      key={c.id}
                      type="button"
                      className="block w-full rounded border border-border/60 px-2 py-1 text-left hover:bg-muted/40"
                      onClick={() => {
                        setIndustryId(c.id);
                        setCandidates(null);
                        setNewIndustryName("");
                      }}
                    >
                      Vincular a “{c.name}”
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => previewMut.mutate()} disabled={!file || !industryId || previewMut.isPending}>
              {previewMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Gerar prévia
            </Button>
            {preview && (
              <Button
                variant="outline"
                onClick={() => discardMut.mutate()}
                disabled={discardMut.isPending || commitMut.isPending}
              >
                {discardMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Descartar prévia
              </Button>
            )}
          </div>

        </CardContent>
      </Card>

      <AlertDialog open={!!gate} onOpenChange={(o) => !o && setGate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esta indústria ainda não está habilitada para checklist.</AlertDialogTitle>
            <AlertDialogDescription>
              {gate?.industryName}. Ao habilitar, ela passa a aparecer no fluxo de checklist e a
              prévia continua com o arquivo já enviado — sem novo upload. {MISSING_PERIOD_WARNING}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                enableAndContinueMut.mutate();
              }}
              disabled={enableAndContinueMut.isPending}
            >
              Habilitar e continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rejected && (
        <Card className="glass-panel border-destructive/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1 min-w-0">
                <p className="font-medium text-destructive">
                  Este arquivo parece ser a Base MK9 (roteiro/consulta). Importe-o em Importações › Base MK9.
                </p>
                <p className="text-xs text-muted-foreground">{rejected.reason}</p>
                {rejected.sheets.length > 0 && (
                  <p className="text-xs text-muted-foreground">Abas encontradas: {rejected.sheets.join(", ")}</p>
                )}
              </div>
            </div>
            {onSwitchToBase && (
              <div>
                <Button size="sm" onClick={() => { setRejected(null); onSwitchToBase(); }}>
                  Ir para Base MK9
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {lastError && <ErrorPanel err={lastError} onDismiss={() => setLastError(null)} />}



      {preview && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>
              Prévia — {preview.filename}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {preview.industryName} · {MONTHS[preview.operationMonth - 1]}/{preview.operationYear}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <MiniStat label="Total de lojas" value={preview.counters.totalStores} />
              <MiniStat label="Total de visitas" value={preview.counters.totalMarks} />
              <MiniStat label="Visita mensal" value={preview.counters.totalContractedFrequency ?? 0} tone="blue" />
              <MiniStat label="Lojas encontradas" value={preview.counters.storesFound} tone="green" />
              <MiniStat label="Vinculadas por similaridade" value={preview.counters.storesLinkedBySimilarity} tone="blue" />
              <MiniStat label="Novas lojas" value={preview.counters.storesNew} tone="amber" />
            </div>

            <div className="rounded-lg border bg-card/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-[color:var(--color-kpi-amber)]" />
                Relatório de divergência da importação
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                <AuditStat label="Lojas criadas" value={preview.counters.storesNew} />
                <AuditStat label="Lojas vinculadas" value={(preview.counters.storesFound ?? 0) + (preview.counters.storesLinkedBySimilarity ?? 0)} />
                <AuditStat label="Não encontradas" value={preview.counters.storesNotFound ?? 0} />
                <AuditStat label="Freq. não importadas" value={preview.counters.frequenciesNotImported ?? 0} />
                <AuditStat label="Duplicidades" value={preview.counters.duplicateStoreNames ?? 0} />
              </div>
            </div>

            {(preview.storeFrequencies?.length ?? 0) > 0 && (
              <div className="rounded-lg border bg-card/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
                  <span>Frequências identificadas</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Quinzenais (0,5x/semana · 2x/mês): {preview.counters.biweeklyFrequencies ?? 0}
                  </span>
                </div>
                {(preview.counters.inconsistentFrequencies ?? 0) > 0 && (
                  <div className="mb-2 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Frequência semanal e mensal divergentes em {preview.counters.inconsistentFrequencies} loja(s).
                    Revise o cadastro — nada é corrigido automaticamente.
                  </div>
                )}
                <div className="max-h-48 space-y-1 overflow-auto text-xs">
                  {preview.storeFrequencies.slice(0, 60).map((f: any, i: number) => (

                    <div key={`${f.storeNormalized}-${i}`} className="flex items-center justify-between gap-3 rounded px-1 py-0.5">
                      <span className="truncate">{f.storeName}{f.uf ? ` · ${f.uf}` : ""}</span>
                      <span className={f.frequencyInconsistent ? "shrink-0 text-amber-700 dark:text-amber-300" : "shrink-0 text-muted-foreground"}>
                        {f.frequencyLabel ?? "Frequência não informada"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.counters.storesNew > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                Esta importação poderá cadastrar automaticamente {preview.counters.storesNew} nova(s) loja(s) na Base MK9.
                Os dados ausentes serão marcados como “Não informado” e poderão ser completados depois em Cadastros › Lojas.
              </div>
            )}

            <div className="space-y-3 border-t pt-4">
              {newStoresCount > 0 && (
                <label
                  ref={ackRef}
                  className={`flex items-start gap-3 rounded-md border p-3 text-sm cursor-pointer transition-all ${
                    highlightAck
                      ? "border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/60 animate-pulse"
                      : "border-amber-500/40 bg-amber-500/5"
                  } text-amber-800 dark:text-amber-300`}
                >
                  <Checkbox
                    className="mt-0.5 border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white"
                    checked={ackNewStores}
                    onCheckedChange={(checked) => setAckNewStores(checked === true)}
                  />
                  <span>
                    Estou ciente de que <strong>{newStoresCount}</strong> novas lojas serão cadastradas
                    automaticamente na Base MK9.
                  </span>
                </label>
              )}
              <div className="flex items-center gap-3">
                <div
                  onClick={() => {
                    if (!canConfirm && newStoresCount > 0 && !ackNewStores) flashAck();
                  }}
                >
                  <Button
                    size="lg"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!canConfirm}
                  >
                    {commitMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Confirmar importação
                  </Button>
                </div>
                {!canConfirm && newStoresCount > 0 && !ackNewStores && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Marque a confirmação sobre as novas lojas para habilitar a importação.
                  </p>
                )}
                {validItems === 0 && (
                  <p className="text-xs text-destructive">Nenhuma visita válida para importar.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "found", "linked_by_similarity", "new_store", "invalid_date"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-transparent hover:bg-accent"
                  }`}
                >
                  {f === "all" && "Todos"}
                  {f === "found" && "Encontradas"}
                  {f === "linked_by_similarity" && "Vinculadas por similaridade"}
                  {f === "new_store" && "Nova loja"}
                  {f === "invalid_date" && "Data inválida"}
                </button>
              ))}
              <Badge variant="secondary">{filtered.length} linhas</Badge>
            </div>

            <div className="max-h-96 overflow-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Loja</th>
                    <th className="text-left p-2">UF</th>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                   {filtered.slice(0, 500).map((it: any, i: number) => (

                    <tr key={i} className="border-t">
                      <td className="p-2 max-w-[280px] truncate" title={it.storeName}>{it.storeName}</td>
                      <td className="p-2">{it.uf ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">{shortDate(it.scheduledDate)}</td>
                      <td className="p-2">
                        {it.status === "found" && <Badge variant="default">Encontrada</Badge>}
                        {it.status === "linked_by_similarity" && <Badge variant="secondary">Similaridade</Badge>}
                        {it.status === "new_store" && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                            NOVA LOJA
                          </Badge>
                        )}
                        {it.status === "store_not_found" && <Badge variant="destructive">Loja não encontrada</Badge>}
                        {it.status === "invalid_date" && <Badge variant="secondary">Data inválida</Badge>}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {it.status === "found" && "Vincular à loja existente"}
                        {it.status === "linked_by_similarity" &&
                          `Vinculada por correspondência aproximada${it.matchedStoreName ? ` → ${it.matchedStoreName}` : ""}${it.similarityScore ? ` (${Math.round(it.similarityScore * 100)}%)` : ""}`}
                        {it.status === "new_store" && "Criar nova loja automaticamente"}
                        {(it.status === "store_not_found" || it.status === "invalid_date") && (it.message ?? "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <div className="p-2 text-xs text-muted-foreground">Mostrando 500 de {filtered.length}</div>
              )}
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Avisos</div>
                <ul className="mt-1 list-disc list-inside space-y-0.5">
                  {preview.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}

                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Histórico de checklists</CardTitle>
        </CardHeader>
        <CardContent>
          {historyQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (historyQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum checklist importado.</p>
          ) : (
            <div className="space-y-2">
              {(historyQ.data ?? []).map((imp: any) => {
                const st = STATUS_LABEL[imp.status] ?? { label: imp.status, variant: "secondary" as const };
                const vs = imp.validationStatus ? VALIDATION_LABEL[imp.validationStatus] : null;
                const c: any = imp.counters ?? {};
                return (
                  <div key={imp.id} className="text-sm rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{imp.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {imp.industryName} · {MONTHS[imp.operationMonth - 1]} {imp.operationYear}
                          {c.persisted != null && ` · ${c.persisted} novas / ${c.skipped ?? 0} já existentes`}
                          {imp.errorMessage && ` · ${imp.errorMessage}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={st.variant}>{st.label}</Badge>
                        {vs && <Badge variant={vs.variant}>{vs.label}</Badge>}
                        <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(imp.id)} disabled={deleteMut.isPending}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <ValidationPanel importId={imp.id} initial={imp.validationDetails ?? null} onReloaded={() => historyQ.refetch()} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>


      <AlertDialog open={confirmOpen} onOpenChange={(o) => !commitMut.isPending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importação do checklist</AlertDialogTitle>
            <AlertDialogDescription>
              As visitas realizadas serão persistidas com origem CHECKLIST. Reimportar o mesmo período não gera duplicatas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <ConfirmRow label="Indústria" value={preview.industryName} />
                <ConfirmRow label="Competência" value={`${MONTHS[preview.operationMonth - 1]}/${preview.operationYear}`} />
                {periodLabel && <ConfirmRow label="Período detectado" value={periodLabel} />}
                <ConfirmRow label="Visitas a persistir" value={validItems} />
                <ConfirmRow label="Lojas do Excel" value={preview.counters.totalStores} />
                <ConfirmRow label="Visita mensal total" value={preview.counters.totalContractedFrequency ?? 0} />
                <ConfirmRow label="Lojas existentes" value={preview.counters.storesFound} />
                <ConfirmRow label="Vínculos por similaridade" value={preview.counters.storesLinkedBySimilarity} />
                <ConfirmRow label="Novas lojas a cadastrar" value={preview.counters.storesNew} />
              </div>

              {commitMut.isPending && (
                <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Progresso
                  </p>
                  <PhaseRow active={phase === "confirming"} done={["stores","visits","reconcile","done"].includes(phase)} label="Confirmando importação…" />
                  <PhaseRow active={phase === "stores"} done={["visits","reconcile","done"].includes(phase)} label="Criando lojas…" />
                  <PhaseRow active={phase === "visits"} done={["reconcile","done"].includes(phase)} label="Persistindo visitas…" />
                  <PhaseRow active={phase === "reconcile"} done={phase === "done"} label="Executando conciliação…" />
                  {phase === "done" && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Concluído.</p>
                  )}
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={commitMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                console.log("[CHECKLIST] confirmação final clicada");
                commitMut.mutate();
              }}
              disabled={!canConfirm}
            >
              {commitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar importação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PhaseRow({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      ) : active ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : (
        <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
      )}
      <span className={done ? "text-muted-foreground line-through" : active ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

function ValidationPanel({
  importId,
  initial,
  onReloaded,
}: {
  importId: string;
  initial: any | null;
  onReloaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any | null>(initial);
  const reprocessFn = useServerFn(checklistReprocessValidation);
  const getFn = useServerFn(checklistGetValidation);
  const reprocessMut = useMutation({
    mutationFn: async () => reprocessFn({ data: { importId } }),
    onSuccess: (r: any) => {
      setData(r.validation);
      toast.success("Auditoria recomputada.");
      onReloaded();
    },
    onError: (e: any) => toast.error(`Falha ao recomputar auditoria: ${e?.message ?? e}`),
  });
  const refreshMut = useMutation({
    mutationFn: async () => getFn({ data: { importId } }),
    onSuccess: (r: any) => setData(r.validation),
  });

  const hasData = !!data;
  const stores = (data?.stores ?? []) as any[];
  const divergent = stores.filter((s: any) => s.status !== "OK");

  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && !hasData) refreshMut.mutate();
        }}
      >
        {open ? "Ocultar auditoria" : "Ver auditoria em 3 níveis"}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {!hasData && refreshMut.isPending && (
            <p className="text-xs text-muted-foreground">Carregando auditoria…</p>
          )}
          {!hasData && !refreshMut.isPending && (
            <p className="text-xs text-muted-foreground">
              Nenhuma auditoria registrada para essa importação. Clique em "Reprocessar auditoria" para gerar.
            </p>
          )}
          {hasData && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <MiniStat label="Declarado (planilha)" value={data.declaredTotal ?? data.declaredSum ?? 0} tone="blue" />
                <MiniStat label="Identificado (Excel)" value={data.parsedTotal ?? 0} tone="blue" />
                <MiniStat label="Persistido (banco)" value={data.persistedTotal ?? 0} tone={data.status === "INCONSISTENT" ? "red" : "green"} />
                <MiniStat label="Lojas divergentes" value={divergent.length} tone={divergent.length ? "amber" : "green"} />
              </div>
              {Array.isArray(data.summaryLines) && data.summaryLines.length > 0 && (
                <ul className="text-xs list-disc pl-5 space-y-0.5 text-muted-foreground">
                  {data.summaryLines.map((l: string, i: number) => (<li key={i}>{l}</li>))}
                </ul>
              )}
              {divergent.length > 0 && (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Loja</th>
                        <th className="text-left p-2">UF</th>
                        <th className="text-right p-2">Declar.</th>
                        <th className="text-right p-2">Identif.</th>
                        <th className="text-right p-2">Persist.</th>
                        <th className="text-left p-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {divergent.map((s: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-medium">{s.storeName}</td>
                          <td className="p-2 text-muted-foreground">{s.uf ?? "—"}</td>
                          <td className="p-2 text-right">{s.declared ?? "—"}</td>
                          <td className="p-2 text-right">{s.parsed}</td>
                          <td className="p-2 text-right">{s.persisted ?? "—"}</td>
                          <td className="p-2 text-destructive">{s.message ?? s.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => reprocessMut.mutate()} disabled={reprocessMut.isPending}>
                  {reprocessMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Reprocessar auditoria
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}



function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" | "blue" | "amber" }) {
  const toneClass =
    tone === "green" ? "text-[color:var(--color-kpi-green)]" :
    tone === "red" ? "text-destructive" :
    tone === "blue" ? "text-primary" :
    tone === "amber" ? "text-[color:var(--color-kpi-amber)]" : "";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function AuditStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background/40 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: number | string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </>
  );
}

function Row({ k, v }: { k: string; v: unknown }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono break-all">{typeof v === "string" ? v : JSON.stringify(v)}</span>
    </div>
  );
}

function getDiagnostics(err: RichError): ChecklistDebugEvent[] {
  const maybe = err.extra?.diagnostics;
  return Array.isArray(maybe) ? (maybe as ChecklistDebugEvent[]) : [];
}

function ErrorPanel({ err, onDismiss }: { err: RichError; onDismiss: () => void }) {
  const [showStack, setShowStack] = useState(false);
  const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;
  const diagnostics = getDiagnostics(err);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(err, null, 2));
      toast.success("Detalhes copiados");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <Card className="glass-panel border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Erro na importação {err.step ? `— ${err.step}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 text-sm">
          <p className="font-medium text-destructive">{err.message}</p>
          {err.name && <p className="text-xs text-muted-foreground mt-1">{err.name}</p>}
        </div>

        <div className="space-y-1">
          <Row k="Função" v={err.function} />
          <Row k="Etapa" v={err.step} />
          <Row k="Arquivo" v={err.file} />
          <Row k="Linha" v={err.line} />
        </div>

        {err.validation && (
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validação</p>
            <Row k="Campo" v={err.validation.field} />
            <Row k="Esperado" v={err.validation.expected} />
            <Row k="Recebido" v={err.validation.received} />
            <Row k="Issues" v={err.validation.issues} />
          </div>
        )}

        {err.database && (
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Banco de dados</p>
            <Row k="Código PG" v={err.database.code} />
            <Row k="Tabela" v={err.database.table} />
            <Row k="Coluna" v={err.database.column} />
            <Row k="Constraint" v={err.database.constraint} />
            <Row k="Valor" v={err.database.value} />
            <Row k="Details" v={err.database.details} />
            <Row k="Hint" v={err.database.hint} />
          </div>
        )}

        {err.parser && (
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parser</p>
            <Row k="Aba" v={err.parser.sheet} />
            <Row k="Linha" v={err.parser.row} />
            <Row k="Coluna" v={err.parser.column} />
            <Row k="Valor" v={err.parser.value} />
          </div>
        )}

        {err.extra && Object.keys(err.extra).length > 0 && (
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contexto</p>
            {Object.entries(err.extra).map(([k, v]) => <Row key={k} k={k} v={v} />)}
          </div>
        )}

        {diagnostics.length > 0 && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trilha de execução</p>
            <div className="max-h-72 overflow-auto space-y-2">
              {diagnostics.map((event, i) => (
                <div key={`${event.at}-${i}`} className="rounded-md bg-muted/30 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={event.level === "error" ? "destructive" : "secondary"}>{event.level}</Badge>
                    <span className="font-mono font-medium">{event.step}</span>
                    <span className="text-muted-foreground">{event.message}</span>
                  </div>
                  {event.data && Object.keys(event.data).length > 0 && (
                    <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isDev && err.stack && (
          <div className="rounded-md border p-3">
            <button
              onClick={() => setShowStack((s) => !s)}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Stack trace {showStack ? "▾" : "▸"}
            </button>
            {showStack && (
              <pre className="mt-2 max-h-64 overflow-auto text-[11px] font-mono whitespace-pre-wrap">
                {err.stack}
              </pre>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copy}>Copiar detalhes técnicos</Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>Fechar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

