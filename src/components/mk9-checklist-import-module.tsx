import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  checklistPreview,
  checklistCommit,
  checklistList,
  checklistDelete,
} from "@/lib/mk9-checklist.functions";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";
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

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

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

function parseServerError(e: any): RichError {
  const raw = e?.message ?? String(e ?? "");
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.__mk9Error) return parsed as RichError;
  } catch {}
  return { message: raw || "Erro desconhecido", raw };
}

export function Mk9ChecklistImportModule() {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [industryId, setIndustryId] = useState<string>("");
  const [preview, setPreview] = useState<ChecklistPreview | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "found" | "store_not_found" | "invalid_date">("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastError, setLastError] = useState<RichError | null>(null);


  const previewFn = useServerFn(checklistPreview);
  const commitFn = useServerFn(checklistCommit);
  const listFn = useServerFn(checklistList);
  const deleteFn = useServerFn(checklistDelete);
  const industriesFn = useServerFn(mk9ListIndustries);
  const qc = useQueryClient();

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn() });
  const historyQ = useQuery({ queryKey: ["mk9-checklist-imports"], queryFn: () => listFn() });

  const previewMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione a planilha do checklist");
      if (!industryId) throw new Error("Selecione a indústria");
      const base64 = await fileToBase64(file);
      return previewFn({
        data: { filename: file.name, base64, industryId, operationMonth: month, operationYear: year },
      });
    },
    onSuccess: (res) => {
      setPreview(res.preview);
      setImportId(res.importId);
      setLastError(null);
      toast.success("Prévia gerada");
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
    },
    onError: (e: any) => {
      const rich = parseServerError(e);
      setLastError(rich);
      toast.error(rich.message ?? "Falha ao gerar prévia", { duration: 10000 });
    },
  });

  const commitMut = useMutation({
    mutationFn: async () => {
      if (!preview || !importId) throw new Error("Gere a prévia antes");
      const items = preview.items
        .filter((i) => i.status === "found" && i.storeId && i.scheduledDate)
        .map((i) => ({ storeId: i.storeId!, scheduledDate: i.scheduledDate }));
      if (!items.length) throw new Error("Nenhuma visita válida para importar");
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
      setLastError(null);
      toast.success("Checklist importado", {
        description: `${res.persisted} novas · ${res.skipped} já existentes · ${res.total} avaliadas`,
        duration: 8000,
      });
      setPreview(null);
      setImportId(null);
      setFile(null);
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
    },
    onError: (e: any) => {
      const rich = parseServerError(e);
      setLastError(rich);
      toast.error(rich.message ?? "Falha ao confirmar", { duration: 10000 });
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["mk9-checklist-imports"] });
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

  const items = preview?.items ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.status === filter)),
    [items, filter],
  );

  const validItems = items.filter((i) => i.status === "found").length;

  return (
    <div className="space-y-6">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Importar checklist da indústria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Arquivo .xlsx</label>
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
                {(industriesQ.data ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => previewMut.mutate()} disabled={!file || !industryId || previewMut.isPending}>
              {previewMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Gerar prévia
            </Button>
            {preview && (
              <Button onClick={() => setConfirmOpen(true)} disabled={commitMut.isPending || validItems === 0}>
                {commitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar importação
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
              <MiniStat label="Lojas encontradas" value={preview.counters.storesFound} tone="green" />
              <MiniStat label="Lojas não encontradas" value={preview.counters.storesNotFound} tone="red" />
              <MiniStat label="Datas válidas" value={preview.counters.validDates} tone="blue" />
              <MiniStat label="Datas inválidas" value={preview.counters.invalidDates} tone="amber" />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "found", "store_not_found", "invalid_date"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-transparent hover:bg-accent"
                  }`}
                >
                  {f === "all" && "Todos"}
                  {f === "found" && "Encontradas"}
                  {f === "store_not_found" && "Loja não encontrada"}
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
                  {filtered.slice(0, 500).map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 max-w-[280px] truncate" title={it.storeName}>{it.storeName}</td>
                      <td className="p-2">{it.uf ?? "—"}</td>
                      <td className="p-2 whitespace-nowrap">{shortDate(it.scheduledDate)}</td>
                      <td className="p-2">
                        {it.status === "found" && <Badge variant="default">Encontrada</Badge>}
                        {it.status === "store_not_found" && <Badge variant="destructive">Loja não encontrada</Badge>}
                        {it.status === "invalid_date" && <Badge variant="secondary">Data inválida</Badge>}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {it.status === "found" ? "Criar visita realizada" : it.message ?? "—"}
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
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
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
              {(historyQ.data ?? []).map((imp) => {
                const st = STATUS_LABEL[imp.status] ?? { label: imp.status, variant: "secondary" as const };
                const c: any = imp.counters ?? {};
                return (
                  <div key={imp.id} className="text-sm rounded-lg border p-3 flex items-center justify-between">
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
                      <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(imp.id)} disabled={deleteMut.isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
            <div className="grid grid-cols-2 gap-2 text-sm">
              <ConfirmRow label="Indústria" value={preview.industryName} />
              <ConfirmRow label="Período" value={`${MONTHS[preview.operationMonth - 1]}/${preview.operationYear}`} />
              <ConfirmRow label="Visitas válidas" value={validItems} />
              <ConfirmRow label="Datas inválidas" value={preview.counters.invalidDates} />
              <ConfirmRow label="Lojas não encontradas" value={preview.counters.storesNotFound} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={commitMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); commitMut.mutate(); }} disabled={commitMut.isPending}>
              {commitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar importação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function ConfirmRow({ label, value }: { label: string; value: number | string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </>
  );
}
