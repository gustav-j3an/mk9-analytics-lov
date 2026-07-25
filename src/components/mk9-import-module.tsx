import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  mk9PreviewImport,
  mk9CommitImport,
  mk9ListImports,
} from "@/lib/mk9-import.functions";
import type { ImportPreview, SyncMode } from "@/lib/mk9/types";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const SYNC_MODES: Array<{ id: SyncMode; label: string }> = [
  { id: "full", label: "Atualizar base e roteiro completo" },
  { id: "add_only", label: "Somente adicionar novos" },
  { id: "registry_only", label: "Somente atualizar cadastros" },
  { id: "routes_only", label: "Somente atualizar roteiro" },
];

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export function Mk9ImportModule() {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [syncMode, setSyncMode] = useState<SyncMode>("full");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const previewFn = useServerFn(mk9PreviewImport);
  const commitFn = useServerFn(mk9CommitImport);
  const listFn = useServerFn(mk9ListImports);
  const qc = useQueryClient();

  const historyQ = useQuery({ queryKey: ["mk9-imports"], queryFn: () => listFn() });

  const previewMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione a planilha");
      const base64 = await fileToBase64(file);
      return previewFn({ data: { filename: file.name, base64, operationMonth: month, operationYear: year, syncMode } });
    },
    onSuccess: (res) => {
      setPreview(res.preview);
      setImportId(res.importId);
      toast.success("Prévia gerada");
      qc.invalidateQueries({ queryKey: ["mk9-imports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar prévia"),
  });

  const commitMut = useMutation({
    mutationFn: async () => {
      if (!file || !importId) throw new Error("Gere a prévia antes");
      const base64 = await fileToBase64(file);
      return commitFn({ data: { importId, filename: file.name, base64, operationMonth: month, operationYear: year, syncMode } });
    },
    onSuccess: () => {
      toast.success("Base MK9 atualizada");
      setPreview(null); setImportId(null); setFile(null);
      qc.invalidateQueries({ queryKey: ["mk9-imports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao confirmar"),
  });

  const items = preview?.items ?? [];
  const filtered = filter === "all" ? items : items.filter((it) => it.action === filter);
  const c = preview?.counters;

  return (
    <div className="space-y-6">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Importar planilha MK9</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Arquivo .xlsx</label>
              <Input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
            <label className="text-sm text-muted-foreground">Modo de sincronização</label>
            <Select value={syncMode} onValueChange={(v) => setSyncMode(v as SyncMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SYNC_MODES.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => previewMut.mutate()} disabled={!file || previewMut.isPending}>
              {previewMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Gerar prévia
            </Button>
            {preview && (
              <Button variant="default" onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>
                {commitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Atualizar base MK9
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {preview && c && (
        <Card className="glass-panel">
          <CardHeader><CardTitle>Prévia — {preview.filename}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <Stat label="Indústrias" created={c.industriesCreated} updated={c.industriesUpdated} />
              <Stat label="Lojas" created={c.storesCreated} updated={c.storesUpdated} />
              <Stat label="Promotores" created={c.promotersCreated} updated={c.promotersUpdated} />
              <Stat label="Rotas" created={c.routesCreated} updated={c.routesUpdated} extra={`${c.routesKept} mantidas / ${c.routesRemoved} removidas`} />
              <Stat label="Visitas" created={c.visitsCreated} updated={c.visitsUpdated} extra={`${c.visitsPreserved} preservadas`} />
            </div>
            <div className="flex flex-wrap gap-2">
              {["all","create","update","keep","remove","duplicate","ambiguous","invalid","preserved"].map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full border ${filter===f?"bg-primary text-primary-foreground":"bg-transparent"}`}>
                  {f}
                </button>
              ))}
              <Badge variant="secondary">{filtered.length} linhas</Badge>
            </div>
            <div className="max-h-96 overflow-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Aba</th><th className="text-left p-2">Linha</th>
                    <th className="text-left p-2">Entidade</th><th className="text-left p-2">Ação</th>
                    <th className="text-left p-2">Detalhes</th><th className="text-left p-2">Alertas</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{it.sheet}</td>
                      <td className="p-2">{it.excelRow ?? "-"}</td>
                      <td className="p-2">{it.entityType}</td>
                      <td className="p-2"><ActionBadge action={it.action} /></td>
                      <td className="p-2 max-w-md truncate" title={JSON.stringify(it.payload)}>{summarize(it.payload)}</td>
                      <td className="p-2 text-amber-600">{(it.warnings ?? []).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && <div className="p-2 text-xs text-muted-foreground">Mostrando 500 de {filtered.length}</div>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-panel">
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Histórico de importações</CardTitle></CardHeader>
        <CardContent>
          {historyQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (historyQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>
          ) : (
            <div className="space-y-2">
              {(historyQ.data ?? []).map((imp) => (
                <div key={imp.id} className="flex items-center justify-between text-sm p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{imp.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {MONTHS[imp.operationMonth - 1]} {imp.operationYear} · modo {imp.syncMode} · {imp.sheetsAnalyzed.length} abas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={imp.status === "done" ? "default" : imp.status === "failed" ? "destructive" : "secondary"}>
                      {imp.status}
                    </Badge>
                    {imp.errorMessage && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, created, updated, extra }: { label: string; created?: number; updated?: number; extra?: string }) {
  return (
    <div className="p-3 rounded-lg border bg-card/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">+{created ?? 0} / ~{updated ?? 0}</p>
      {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
    </div>
  );
}
function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    create: "bg-emerald-500/15 text-emerald-600",
    update: "bg-blue-500/15 text-blue-600",
    keep: "bg-gray-500/15 text-gray-600",
    remove: "bg-red-500/15 text-red-600",
    duplicate: "bg-yellow-500/15 text-yellow-700",
    ambiguous: "bg-orange-500/15 text-orange-600",
    invalid: "bg-destructive/15 text-destructive",
    preserved: "bg-purple-500/15 text-purple-600",
    conflict: "bg-pink-500/15 text-pink-600",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${map[action] ?? ""}`}>{action}</span>;
}
function summarize(payload: any): string {
  if (!payload) return "";
  const parts: string[] = [];
  for (const k of ["name","industry","store","promoter","weekday","date"]) {
    if (payload[k] !== undefined) parts.push(`${k}: ${payload[k]}`);
  }
  return parts.join(" · ") || JSON.stringify(payload).slice(0, 80);
}
