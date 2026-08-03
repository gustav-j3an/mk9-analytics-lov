import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  ShieldAlert, 
  Search, 
  Trash2, 
  AlertTriangle, 
  Loader2, 
  History,
  Info,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  FileText,
  Activity,
  User,
  Clock,
  ExternalLink,
  MapPin,
  Route as RouteIcon,
  Zap,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getCleanupDiagnosis, executeGranularCleanup } from "@/lib/mk9-cleanup.functions";
import { getBananaHotfixTrace } from "@/lib/mk9-hotfix.functions";
import { mk9ListChecklistIndustries } from "@/lib/mk9-data.functions";
import { cn } from "@/lib/utils";



const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export function Mk9AdminCleanupModule(props: { month: number, year: number }) {
  const [industryId, setIndustryId] = useState("");
  const [month, setMonth] = useState(props.month);
  const [year, setYear] = useState(props.year);
  
  // Sincroniza quando os filtros globais mudam, a menos que o usuário tenha começado a interagir.
  // Se ele já buscou algo, mantemos a visão dele estável.
  useEffect(() => {
    if (!previewMut.data && !previewMut.isPending) {
      setMonth(props.month);
      setYear(props.year);
    }
  }, [props.month, props.year]);
  const [justification, setJustification] = useState("");
  const [selections, setSelections] = useState({
    importIds: [] as string[],
    visitIds: [] as string[],
    frequencyIds: [] as string[],
    routeIds: [] as string[]
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listIndustriesFn = useServerFn(mk9ListChecklistIndustries);
  const diagnosisFn = useServerFn(getCleanupDiagnosis);
  const executeFn = useServerFn(executeGranularCleanup);

  const industriesQ = useQuery({ 
    queryKey: ["mk9-industries"], 
    queryFn: () => listIndustriesFn() 
  });

  const previewMut = useMutation({
    mutationFn: async () => {
      try {
        const res = await diagnosisFn({ data: { industryId, month, year } });
        return res;
      } catch (err: any) {
        console.error("[CLEANUP UI ERROR]", err);
        throw err;
      }
    },
    onSuccess: (res: any) => {
      if (!res) return;
      setSelections({
        importIds: (res.imports ?? []).map((i: any) => i.id),
        visitIds: (res.visits ?? []).map((v: any) => v.id),
        frequencyIds: (res.frequencies ?? []).filter((f: any) => !f.archived_at).map((f: any) => f.id),
        routeIds: (res.routes ?? []).filter((r: any) => !r.valid_until).map((r: any) => r.id),
      });
      
      if (res.errors?.length > 0) {
        toast.warning("Algumas fontes falharam ao carregar", {
          description: "O diagnóstico pode estar incompleto."
        });
      } else {
        toast.success("Diagnóstico concluído");
      }
    },
    onError: (err: any) => {
      const msg = err?.message || "Erro desconhecido";
      if (msg.includes("401") || msg.includes("Unauthorized")) {
        toast.error("Sessão expirada. Por favor, faça login novamente.");
      } else if (msg.includes("403") || msg.includes("Forbidden")) {
        toast.error("Você não possui acesso a esta indústria.");
      } else {
        toast.error("Erro ao carregar diagnóstico", {
          description: "A página não caiu, mas a consulta falhou. Tente novamente."
        });
      }
    }
  });

  const executeMut = useMutation({
    mutationFn: () => executeFn({ 
      data: { 
        industryId, month, year, 
        justification, 
        selections
      } 
    }),
    onSuccess: (res: any) => {
      toast.success("Limpeza executada com sucesso", {
        description: `Antes: ${res.before.contracted}c / ${res.before.actual}r. Depois: ${res.after.contracted}c / ${res.after.actual}r.`
      });
      previewMut.reset();
      setIndustryId("");
      setJustification("");
      setConfirmOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na limpeza")
  });

  const industries = industriesQ.data ?? [];
  const previewData = previewMut.data;

  if (previewMut.isError && !previewData) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Card className="glass-panel border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">Erro Crítico no Carregamento</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Não foi possível carregar o diagnóstico desta competência. A página não caiu, mas o servidor retornou um erro.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => {
              previewMut.reset();
              setIndustryId("");
            }}>Voltar</Button>
            <Button onClick={() => previewMut.mutate()}>Tentar Novamente</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Card className="glass-panel border-amber-500/20 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" />
            Limpeza Manual por Competência (ADMIN)
              <Button 
                size="sm" 
                variant="outline" 
                className="ml-auto text-[10px] h-7 gap-1.5 border-red-500/30 text-red-600 hover:bg-red-50"
                onClick={async () => {
                  const confirmed = window.confirm("ATENÇÃO: Isso removerá TODOS os dados de BANANA CORRENTE em Julho/2026 usando o motor do PDF. Confirmar?");
                  if (!confirmed) return;
                  
                  const toastId = toast.loading("Executando Hotfix BANANA...");
                  try {
                    const traceFn = (await import("@/lib/mk9-hotfix.functions")).getBananaHotfixTrace;
                    const res = (await traceFn()) as any;
                    console.log("[HOTFIX RESULTS]", res);
                    toast.success("Hotfix BANANA executado com sucesso!", { 
                      id: toastId,
                      description: `Antes: ${res.before?.contracted ?? 0}c/${res.before?.actual ?? 0}r. Depois: ${res.after?.contracted ?? 0}c/${res.after?.actual ?? 0}r.`
                    });
                  } catch (e: any) {
                    toast.error(e?.message || "Erro no Hotfix", { id: toastId });
                  }
                }}
              >
                <Zap className="h-3 w-3" /> Executar Hotfix BANANA
              </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">Indústria</label>
              <Select value={industryId} onValueChange={setIndustryId}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Selecione a indústria" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">Mês</label>
              <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">Ano</label>
              <Input 
                type="number" 
                value={year} 
                onChange={e => setYear(Number(e.target.value))}
                className="bg-background/50"
              />
            </div>
          </div>

          <Button 
            onClick={() => previewMut.mutate()} 
            disabled={!industryId || previewMut.isPending}
            className="w-full md:w-auto"
          >
            {previewMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Analisar Competência
          </Button>
        </CardContent>
      </Card>

      {previewData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
          {/* TRACE DO RELATÓRIO (PDF) */}
          <Card className="glass-panel border-sky-500/20 bg-sky-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-sky-700 dark:text-sky-400">
                <FileText className="h-3 w-3" /> Trace de Origem do Relatório (PDF)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-background/50 border border-sky-500/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Contratadas (PDF)</p>
                  <p className="text-xl font-bold">{previewData.trace?.totals?.contracted ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-sky-500/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Realizadas (PDF)</p>
                  <p className="text-xl font-bold">{previewData.trace?.totals?.actual ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-sky-500/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Lojas no PDF</p>
                  <p className="text-xl font-bold">{previewData.trace?.stores?.length ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-sky-500/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Status</p>
                  <Badge variant="outline" className="mt-1 bg-sky-500/10 text-sky-700 border-sky-500/20">
                    {previewData.trace?.totals?.contracted > 0 || previewData.trace?.totals?.actual > 0 ? "ATIVO NO PDF" : "SEM DADOS"}
                  </Badge>
                </div>
              </div>

              {previewData.trace?.stores?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground px-1">Fontes identificadas pelo motor do PDF</p>
                  <div className="max-h-[120px] overflow-auto border rounded-lg divide-y bg-background/30">
                    {previewData.trace.stores.slice(0, 10).map((s: any) => (
                      <div key={s.id} className="p-2 flex items-center justify-between text-[11px]">
                        <span className="font-medium truncate max-w-[200px]">{s.name}</span>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[9px]">{s.frequencyLabel ?? 'Sem freq'}</Badge>
                          <Badge variant="outline" className="text-[9px] bg-emerald-500/5 text-emerald-700">{s.actual} visitas</Badge>
                        </div>
                      </div>
                    ))}
                    {previewData.trace.stores.length > 10 && (
                      <div className="p-2 text-center text-[10px] text-muted-foreground">
                        + {previewData.trace.stores.length - 10} lojas não listadas no resumo
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Importações" value={(previewData.imports ?? []).length} />
            <StatCard label="Visitas" value={(previewData.visits ?? []).length} tone="red" />
            <StatCard label="Frequências" value={(previewData.frequencies ?? []).length} tone="amber" />
            <StatCard label="Meses Afetados" value={previewData.summary?.futureAffected || 0} tone="amber" />
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-background/50 p-1">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="visits">Visitas ({(previewData.visits ?? []).length})</TabsTrigger>
              <TabsTrigger value="frequencies">Frequências ({(previewData.frequencies ?? []).length})</TabsTrigger>
              <TabsTrigger value="routes">Roteiros/Plan ({(previewData.routes ?? []).length})</TabsTrigger>
            </TabsList>


            <TabsContent value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 glass-panel">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                      <History className="h-4 w-4" /> Diagnóstico Consolidado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl bg-muted/20 border space-y-3">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Resumo de Impacto</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase">Visitas sem Check-in</p>
                          <p className="text-lg font-bold">{(previewData.visits ?? []).filter((v: any) => !v.source_import_id).length}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase">Roteiros Planejados</p>
                          <p className="text-lg font-bold">{(previewData.routes ?? []).length}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase">Reconciliações</p>
                          <p className="text-lg font-bold">{(previewData.reconciliations ?? []).length}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase">Problemas de Qualidade</p>
                          <p className="text-lg font-bold text-red-500">{(previewData.qualityIssues ?? []).length}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Importações Relacionadas</h4>
                      <div className="space-y-2 max-h-[200px] overflow-auto">
                        {(previewData.imports ?? []).map((imp: any) => (
                          <div key={imp.id} className="flex items-center justify-between p-2 rounded-lg bg-background/40 border text-xs">
                            <span className="truncate max-w-[200px]">{imp.filename}</span>
                            <Badge variant="outline" className="text-[9px] uppercase">{imp.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-panel border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" /> Executar Limpeza
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        Serão removidos: {selections.visitIds.length} visitas, {selections.frequencyIds.length} frequências e {selections.routeIds.length} roteiros.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase text-muted-foreground">Justificativa obrigatória</label>
                      <textarea 
                        value={justification}
                        onChange={e => setJustification(e.target.value)}
                        className="w-full min-h-[100px] rounded-lg border bg-background/50 p-3 text-sm focus:ring-2 focus:ring-amber-500/50 outline-none resize-none"
                        placeholder="Descreva o motivo da limpeza..."
                      />
                    </div>

                    <Button 
                      variant="destructive" 
                      className="w-full shadow-lg shadow-destructive/20"
                      disabled={justification.trim().length < 10 || executeMut.isPending}
                      onClick={() => setConfirmOpen(true)}
                    >
                      {executeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      Confirmar Remoção Atômica
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="visits">
              <Card className="glass-panel">
                <CardContent className="pt-6">
                  <div className="space-y-2 max-h-[500px] overflow-auto">
                    {(previewData.visits ?? []).map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/40">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={selections.visitIds.includes(v.id)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelections({...selections, visitIds: [...selections.visitIds, v.id]});
                              else setSelections({...selections, visitIds: selections.visitIds.filter((id: string) => id !== v.id)});
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium">{v.mk9_stores?.name || 'Loja desconhecida'}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{new Date(v.visit_date).toLocaleDateString()} · {v.promoter_name || 'Sem promotor'}</p>
                          </div>
                        </div>
                        {v.source_import_id && <Badge variant="secondary" className="text-[9px]">IMPORTADO</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="frequencies">
              <Card className="glass-panel">
                <CardContent className="pt-6">
                  <div className="space-y-2 max-h-[500px] overflow-auto">
                    {(previewData.frequencies ?? []).map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/40">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={selections.frequencyIds.includes(f.id)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelections({...selections, frequencyIds: [...selections.frequencyIds, f.id]});
                              else setSelections({...selections, frequencyIds: selections.frequencyIds.filter((id: string) => id !== f.id)});
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium">{f.mk9_stores?.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Vigência: {new Date(f.valid_from).toLocaleDateString()} - {f.valid_until ? new Date(f.valid_until).toLocaleDateString() : 'Aberto'}</p>
                          </div>
                        </div>
                        {f.archived_at && <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200">ARQUIVADO</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="routes">
              <Card className="glass-panel">
                <CardContent className="pt-6">
                  <div className="space-y-2 max-h-[500px] overflow-auto">
                    {(previewData.routes ?? []).map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/40">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={selections.routeIds.includes(r.id)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelections({...selections, routeIds: [...selections.routeIds, r.id]});
                              else setSelections({...selections, routeIds: selections.routeIds.filter((id: string) => id !== r.id)});
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium">{r.mk9_stores?.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Frequência: {r.frequency_name} · Período: {r.period_name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Limpeza de Dados
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive text-sm">
                Esta ação irá remover permanentemente <strong>{selections.visitIds.length} visitas</strong> e inativar <strong>{selections.frequencyIds.length} frequências</strong> da indústria <strong>{industries.find((i: any) => i.id === industryId)?.name}</strong> na competência <strong>{MONTHS[month - 1]}/{year}</strong>.
              </div>
              <p className="text-sm">
                Os números operacionais (Dashboard e PDF) serão atualizados imediatamente após a execução.
              </p>
              <p className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Isso não pode ser desfeito.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                executeMut.mutate();
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={executeMut.isPending}
            >
              Confirmar Limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" | "default" }) {
  const toneClass = 
    tone === "red" ? "text-destructive" :
    tone === "amber" ? "text-amber-600 dark:text-amber-400" : 
    "text-foreground";
    
  return (
    <Card className="glass-panel border-none shadow-none bg-background/20">
      <CardContent className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={cn("text-3xl font-bold mt-1", toneClass)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function OptionItem({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox 
        id={label}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-1"
      />
      <div className="space-y-0.5">
        <label htmlFor={label} className="text-sm font-medium leading-none cursor-pointer">{label}</label>
        <p className="text-[11px] text-muted-foreground leading-tight">{description}</p>
      </div>
    </div>
  );
}
