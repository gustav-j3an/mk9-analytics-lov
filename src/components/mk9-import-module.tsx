import { useState } from "react";
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
  ChevronDown,
  ChevronRight,
  Database,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mk9Panel, Mk9PageHeader, Mk9Badge } from "./mk9/design-system";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  mk9PreviewImport,
  mk9CommitImport,
  mk9ListImports,
  mk9DeleteImport,
} from "@/lib/mk9-import.functions";
import { detectMk9FileKind } from "@/lib/mk9/detect-file-kind";
import type { ImportPreview, SyncMode } from "@/lib/mk9/types";

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  pending: { label: "Pendente", variant: "secondary" },
  previewing: { label: "Prévia gerada", variant: "secondary" },
  confirmed: { label: "Confirmada", variant: "secondary" },
  committing: { label: "Processando", variant: "secondary" },
  done: { label: "Concluído", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

const SYNC_MODE_LABEL: Record<string, string> = {
  full: "Atualização completa",
  add_only: "Somente novos",
  registry_only: "Somente cadastros",
  routes_only: "Somente roteiro",
};

const ACTION_LABEL: Record<string, string> = {
  all: "Todos",
  create: "Criar",
  update: "Atualizar",
  keep: "Manter",
  remove: "Remover",
  duplicate: "Duplicados",
  ambiguous: "Ambíguos",
  invalid: "Inválidos",
  preserved: "Preservados",
  conflict: "Conflitos",
};

const ENTITY_LABEL: Record<string, string> = {
  industry: "Indústria",
  store: "Loja",
  promoter: "Promotor",
  frequency: "Frequência",
  route: "Rota",
  visit: "Visita",
};

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
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

// Invalida todas as consultas MK9 (dashboards e telas operacionais).
function invalidateMk9(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [
    "mk9-imports",
    "mk9-industries",
    "mk9-stores",
    "mk9-promoters",
    "mk9-routes",
    "mk9-visits",
    "mk9-overview",
  ]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export function Mk9ImportModule({
  onSwitchToChecklists,
}: { onSwitchToChecklists?: () => void } = {}) {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [syncMode, setSyncMode] = useState<SyncMode>("full");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejected, setRejected] = useState<{ reason: string; sheets: string[] } | null>(null);
  const [resolveConflicts, setResolveConflicts] = useState(false);
  const [showRouteDetails, setShowRouteDetails] = useState(false);

  const previewFn = useServerFn(mk9PreviewImport);
  const commitFn = useServerFn(mk9CommitImport);
  const listFn = useServerFn(mk9ListImports);
  const deleteFn = useServerFn(mk9DeleteImport);
  const qc = useQueryClient();

  const historyQ = useQuery({ queryKey: ["mk9-imports"], queryFn: () => listFn() });

  const deleteMut = useMutation({
    mutationFn: (importId: string) => deleteFn({ data: { importId } }),
    onSuccess: () => {
      toast.success("Histórico removido");
      invalidateMk9(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  const previewMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione a planilha");
      const base64 = await fileToBase64(file);
      return previewFn({
        data: { filename: file.name, base64, operationMonth: month, operationYear: year, syncMode },
      });
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
      return commitFn({
        data: {
          importId,
          filename: file.name,
          base64,
          operationMonth: month,
          operationYear: year,
          syncMode,
          resolveConflicts,
        },
      });
    },
    onSuccess: (res: any) => {
      const c = res?.counters ?? {};
      toast.success("Base MK9 atualizada com sucesso", {
        description: `Indústrias +${c.industriesCreated ?? 0}/~${c.industriesUpdated ?? 0} · Lojas +${c.storesCreated ?? 0}/~${c.storesUpdated ?? 0} · Promotores +${c.promotersCreated ?? 0}/~${c.promotersUpdated ?? 0} · Rotas +${c.routesCreated ?? 0} · Visitas +${c.visitsCreated ?? 0} (${c.visitsPreserved ?? 0} preservadas)`,
        duration: 8000,
      });
      setPreview(null);
      setImportId(null);
      setFile(null);
      setConfirmOpen(false);
      invalidateMk9(qc);
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Falha ao confirmar";
      toast.error(msg, {
        description: msg.length > 80 ? msg.slice(0, 200) : undefined,
        duration: 8000,
      });
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["mk9-imports"] });
    },
  });

  const items = preview?.items ?? [];
  const filtered = filter === "all" ? items : items.filter((it) => it.action === filter);
  const c = preview?.counters;

  return (
    <div className="space-y-6">
      <Mk9PageHeader 
        title="Gestão Operacional" 
        subtitle="Sincronização da base, roteiros e estrutura operacional."
        icon={Database}
      />

      <Mk9Panel>
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-lg bg-command-purple/10 text-command-purple">
            <Upload className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Importar planilha MK9
          </h3>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-white mb-1.5 block drop-shadow-sm">
                Arquivo .xlsx (Base MK9 — roteiro/consulta)
              </label>
              <Input
                type="file"
                accept=".xlsx"
                onChange={async (e) => {
                  const f = e.target.files?.[0] ?? null;
                  setPreview(null);
                  setImportId(null);
                  setRejected(null);
                  if (!f) {
                    setFile(null);
                    return;
                  }
                  const det = await detectMk9FileKind(f);
                  if (det.kind === "checklist") {
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
              <label className="text-sm font-semibold text-white mb-1.5 block drop-shadow-sm">Mês</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-white mb-1.5 block drop-shadow-sm">Ano</label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2024}
                max={2100}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-white mb-1.5 block drop-shadow-sm">Modo de sincronização</label>
            <Select value={syncMode} onValueChange={(v) => setSyncMode(v as SyncMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_MODES.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => previewMut.mutate()} disabled={!file || previewMut.isPending}>
              {previewMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Gerar prévia
            </Button>
            {preview &&
              (() => {
                const conflicts =
                  (preview.routeDiff?.manualConflicts ?? 0) +
                  (preview.routeDiff?.futureConflicts ?? 0);
                const blocked = conflicts > 0 && !resolveConflicts;
                return (
                  <Button
                    variant="default"
                    onClick={() => setConfirmOpen(true)}
                    disabled={commitMut.isPending || blocked}
                    title={
                      blocked
                        ? `Existem ${conflicts} conflitos manuais/futuros. Marque "Resolver conflitos usando planilha" para prosseguir.`
                        : undefined
                    }
                  >
                    {commitMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Atualizar base MK9
                  </Button>
                );
              })()}
          </div>
        </div>
      </Mk9Panel>

      {rejected && (
        <Mk9Panel className="border-destructive/40">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1 min-w-0">
                <p className="font-medium text-destructive">
                  Este arquivo parece ser um checklist mensal. Importe-o em Importações ›
                  Checklists.
                </p>
                <p className="text-xs text-muted-foreground">{rejected.reason}</p>
                {rejected.sheets.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Abas encontradas: {rejected.sheets.join(", ")}
                  </p>
                )}
              </div>
            </div>
            {onSwitchToChecklists && (
              <div>
                <Button
                  size="sm"
                  onClick={() => {
                    setRejected(null);
                    onSwitchToChecklists();
                  }}
                >
                  Ir para Checklists
                </Button>
              </div>
            )}
          </div>
        </Mk9Panel>
      )}

      {preview && c && (
        <Mk9Panel>
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">
              Prévia — {preview.filename}
            </h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard
                label="Indústrias"
                rows={[
                  { k: "Novas", v: c.industriesCreated ?? 0, tone: "green" },
                  { k: "Atualizadas", v: c.industriesUpdated ?? 0, tone: "blue" },
                ]}
              />
              <SummaryCard
                label="Lojas"
                rows={[
                  { k: "Novas", v: c.storesCreated ?? 0, tone: "green" },
                  { k: "Atualizadas", v: c.storesUpdated ?? 0, tone: "blue" },
                ]}
              />
              <SummaryCard
                label="Promotores"
                rows={[
                  { k: "Novos", v: c.promotersCreated ?? 0, tone: "green" },
                  { k: "Atualizados", v: c.promotersUpdated ?? 0, tone: "blue" },
                ]}
              />
              <SummaryCard
                label="Rotas"
                rows={[
                  { k: "Novas", v: c.routesCreated ?? 0, tone: "green" },
                  { k: "Atualizadas", v: c.routesUpdated ?? 0, tone: "blue" },
                  { k: "Mantidas", v: c.routesKept ?? 0, tone: "muted" },
                  { k: "Removidas", v: c.routesRemoved ?? 0, tone: "red" },
                ]}
              />
              <SummaryCard
                label="Visitas"
                rows={[
                  { k: "Novas", v: c.visitsCreated ?? 0, tone: "green" },
                  { k: "Preservadas", v: c.visitsPreserved ?? 0, tone: "violet" },
                ]}
              />
            </div>

            {preview.routeDiff && (
              <RouteDiffPanel
                diff={preview.routeDiff}
                expanded={showRouteDetails}
                onToggle={() => setShowRouteDetails((v) => !v)}
                resolveConflicts={resolveConflicts}
                onToggleResolve={setResolveConflicts}
              />
            )}

            <div className="flex flex-wrap gap-2">
              {(
                [
                  "all",
                  "create",
                  "update",
                  "keep",
                  "remove",
                  "duplicate",
                  "ambiguous",
                  "invalid",
                  "preserved",
                ] as const
              ).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-transparent hover:bg-accent"}`}
                >
                  {ACTION_LABEL[f] ?? f}
                </button>
              ))}
              <Mk9Badge variant="info">{filtered.length} linhas</Mk9Badge>
            </div>
            <div className="max-h-96 overflow-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Aba</th>
                    <th className="text-left p-2">Linha</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Registro</th>
                    <th className="text-left p-2">Ação</th>
                    <th className="text-left p-2">Detalhes</th>
                    <th className="text-left p-2">Alertas</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 whitespace-nowrap">{it.sheet}</td>
                      <td className="p-2">{it.excelRow ?? "-"}</td>
                      <td className="p-2">{ENTITY_LABEL[it.entityType] ?? it.entityType}</td>
                      <td
                        className="p-2 max-w-[220px] truncate"
                        title={String(it.payload?.name ?? recordLabel(it.payload))}
                      >
                        {recordLabel(it.payload)}
                      </td>
                      <td className="p-2">
                        <ActionBadge action={it.action} />
                      </td>
                      <td className="p-2 max-w-md truncate" title={JSON.stringify(it.payload)}>
                        {summarize(it.payload)}
                      </td>
                      <td className="p-2 text-amber-600">{(it.warnings ?? []).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <div className="p-2 text-xs text-muted-foreground">
                  Mostrando 500 de {filtered.length}
                </div>
              )}
            </div>
          </div>
        </Mk9Panel>
      )}

      <Mk9Panel className="relative">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-lg bg-command-purple/10 text-command-purple">
            <Clock className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Histórico de importações
          </h3>
        </div>
        <div>
          {historyQ.isLoading ? (
            <p className="text-sm text-slate-500 italic">Carregando…</p>
          ) : (historyQ.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 italic">Nenhuma importação registrada.</p>
          ) : (
            <div className="space-y-2">
              {(historyQ.data ?? []).map((imp) => {
                const st = STATUS_LABEL[imp.status] ?? {
                  label: imp.status,
                  variant: "secondary" as const,
                };
                const isOpen = !!expanded[imp.id];
                const hasError = !!imp.errorMessage;
                return (
                  <div key={imp.id} className="text-sm rounded-lg border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white truncate">{imp.filename}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                          {MONTHS[imp.operationMonth - 1]} {imp.operationYear} ·{" "}
                          {SYNC_MODE_LABEL[imp.syncMode] ?? imp.syncMode} ·{" "}
                          {imp.sheetsAnalyzed.length} abas
                          {imp.durationMs != null && ` · ${imp.durationMs}ms`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Mk9Badge 
                          variant={st.variant === "default" ? "success" : st.variant === "destructive" ? "danger" : "default"}
                        >
                          {st.label}
                        </Mk9Badge>
                        {hasError && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpanded((s) => ({ ...s, [imp.id]: !s[imp.id] }))}
                            className="h-8 text-slate-400 hover:text-white"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 mr-1" />
                            ) : (
                              <ChevronRight className="h-4 w-4 mr-1" />
                            )}
                            Ver erro
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMut.mutate(imp.id)}
                          disabled={deleteMut.isPending}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {hasError && isOpen && (
                      <div className="mt-3">
                        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 space-y-1">
                          <div className="flex items-center gap-2 text-rose-400 font-medium">
                            <AlertTriangle className="h-4 w-4" /> Erro na importação
                          </div>
                          <p className="text-[11px] whitespace-pre-wrap break-words text-rose-400/90 font-mono">
                            {imp.errorMessage}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase font-black">
                            Iniciada em {new Date(imp.startedAt).toLocaleString("pt-BR")}
                            {imp.finishedAt &&
                              ` · Falhou em ${new Date(imp.finishedAt).toLocaleString("pt-BR")}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Mk9Panel>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => !commitMut.isPending && setConfirmOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atualização da base MK9</AlertDialogTitle>
            <AlertDialogDescription>
              Esta operação vai atualizar cadastros, roteiros e visitas planejadas no banco de
              dados. Visitas já realizadas serão preservadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {c && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <ConfirmRow label="Indústrias novas" value={c.industriesCreated ?? 0} />
              <ConfirmRow label="Indústrias atualizadas" value={c.industriesUpdated ?? 0} />
              <ConfirmRow label="Lojas novas" value={c.storesCreated ?? 0} />
              <ConfirmRow label="Lojas atualizadas" value={c.storesUpdated ?? 0} />
              <ConfirmRow label="Promotores novos" value={c.promotersCreated ?? 0} />
              <ConfirmRow label="Promotores atualizados" value={c.promotersUpdated ?? 0} />
              <ConfirmRow label="Rotas novas" value={c.routesCreated ?? 0} />
              <ConfirmRow label="Rotas removidas" value={c.routesRemoved ?? 0} />
              <ConfirmRow label="Visitas planejadas" value={c.visitsCreated ?? 0} />
              <ConfirmRow label="Visitas preservadas" value={c.visitsPreserved ?? 0} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={commitMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={commitMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                commitMut.mutate();
              }}
            >
              {commitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar atualização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  green: "text-emerald-600",
  blue: "text-blue-600",
  red: "text-red-600",
  muted: "text-muted-foreground",
  violet: "text-violet-600",
};

function SummaryCard({
  label,
  rows,
}: {
  label: string;
  rows: Array<{ k: string; v: number; tone: string }>;
}) {
  return (
    <div className="p-3 rounded-lg border bg-card/50 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {rows.map((r) => (
        <div key={r.k} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{r.k}</span>
          <span className={`font-semibold tabular-nums ${TONE_CLASS[r.tone] ?? ""}`}>{r.v}</span>
        </div>
      ))}
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
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${map[action] ?? ""}`}>
      {ACTION_LABEL[action] ?? action}
    </span>
  );
}

function recordLabel(payload: any): string {
  if (!payload) return "";
  if (payload.name) return String(payload.name);
  const bits = [payload.promoter, payload.store, payload.industry].filter(Boolean);
  if (bits.length) return bits.join(" → ");
  if (payload.date) return String(payload.date);
  return "";
}

const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ROUTE_KIND_LABEL: Record<string, { label: string; className: string }> = {
  UNCHANGED: { label: "Sem alteração", className: "bg-gray-500/15 text-gray-600" },
  NEW_ROUTE: { label: "Nova", className: "bg-emerald-500/15 text-emerald-600" },
  CHANGED_PROMOTER: { label: "Promotor alterado", className: "bg-blue-500/15 text-blue-600" },
  CHANGED_WEEKDAY: { label: "Dia alterado", className: "bg-indigo-500/15 text-indigo-600" },
  REMOVED_FROM_IMPORT: { label: "Removida da planilha", className: "bg-red-500/15 text-red-600" },
  MANUAL_CONFLICT: { label: "Conflito manual", className: "bg-orange-500/15 text-orange-700" },
  FUTURE_VERSION_CONFLICT: {
    label: "Conflito com versão futura",
    className: "bg-pink-500/15 text-pink-600",
  },
};

function RouteDiffPanel({
  diff,
  expanded,
  onToggle,
  resolveConflicts,
  onToggleResolve,
}: {
  diff: NonNullable<ImportPreview["routeDiff"]>;
  expanded: boolean;
  onToggle: () => void;
  resolveConflicts: boolean;
  onToggleResolve: (v: boolean) => void;
}) {
  const conflicts = diff.manualConflicts + diff.futureConflicts;
  return (
    <div className="rounded-xl border bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Roteiro — impacto da reimportação</p>
          <p className="text-xs text-muted-foreground">
            Vigência a partir de {diff.competencyStart} · {diff.totalIncoming} rotas lidas
          </p>
        </div>
        <button className="text-xs underline text-muted-foreground" onClick={onToggle}>
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <RouteDiffStat label="Sem alteração" value={diff.unchanged} tone="muted" />
        <RouteDiffStat label="Novas" value={diff.new} tone="green" />
        <RouteDiffStat label="Promotor alterado" value={diff.changedPromoter} tone="blue" />
        <RouteDiffStat label="Dia alterado" value={diff.changedWeekday} tone="blue" />
        <RouteDiffStat label="Removidas" value={diff.removed} tone="red" />
        <RouteDiffStat
          label="Conflitos manuais"
          value={diff.manualConflicts}
          tone={diff.manualConflicts > 0 ? "red" : "muted"}
        />
        <RouteDiffStat
          label="Conflitos futuros"
          value={diff.futureConflicts}
          tone={diff.futureConflicts > 0 ? "red" : "muted"}
        />
      </div>
      {conflicts > 0 && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs space-y-2">
          <p className="font-semibold text-orange-700">
            {conflicts} conflitos precisam de decisão administrativa
          </p>
          <p className="text-orange-700/80">
            Por padrão a importação NÃO sobrescreve rotas editadas manualmente ou versões futuras.
            Marque a opção abaixo apenas se realmente quer que a planilha prevaleça.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={resolveConflicts}
              onChange={(e) => onToggleResolve(e.target.checked)}
            />
            <span>
              Resolver conflitos usando a planilha (fecha versões conflitantes e cria novas versões
              IMPORT)
            </span>
          </label>
        </div>
      )}
      {expanded && (
        <div className="max-h-96 overflow-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th className="text-left px-2 py-1.5">Classificação</th>
                <th className="text-left px-2 py-1.5">Loja</th>
                <th className="text-left px-2 py-1.5">Indústria</th>
                <th className="text-left px-2 py-1.5">Dia</th>
                <th className="text-left px-2 py-1.5">Promotor (atual → planilha)</th>
                <th className="text-left px-2 py-1.5">Observação</th>
              </tr>
            </thead>
            <tbody>
              {diff.items.map((it, idx) => {
                const k = ROUTE_KIND_LABEL[it.kind] ?? { label: it.kind, className: "" };
                return (
                  <tr key={idx} className="border-t">
                    <td className="px-2 py-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${k.className}`}>
                        {k.label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      {it.storeName ?? "—"}
                      {it.storeUf ? ` (${it.storeUf})` : ""}
                    </td>
                    <td className="px-2 py-1.5">{it.industryName ?? "—"}</td>
                    <td className="px-2 py-1.5">{WEEKDAY_LABEL[it.weekday] ?? it.weekday}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {it.currentPromoterName ?? "—"}
                      {it.incomingPromoterName ? ` → ${it.incomingPromoterName}` : ""}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{it.reason ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RouteDiffStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${TONE_CLASS[tone] ?? ""}`}>{value}</span>
    </div>
  );
}

function summarize(payload: any): string {
  if (!payload) return "";
  const parts: string[] = [];
  for (const k of ["chain", "city", "uf", "weekday", "date", "status", "contracted", "estimated"]) {
    if (payload[k] !== undefined && payload[k] !== null && payload[k] !== "")
      parts.push(`${k}: ${payload[k]}`);
  }
  return parts.join(" · ");
}
