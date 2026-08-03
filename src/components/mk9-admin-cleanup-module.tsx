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
  FileText,
  Activity,
  Layers,
  CheckCircle,
  AlertCircle,
  Zap,
  Clock
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
  const [justification, setJustification] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selections, setSelections] = useState({
    importIds: [] as string[],
    visitIds: [] as string[],
    frequencyIds: [] as string[],
    projectionIds: [] as string[],
    routeIds: [] as string[]
  });

  const listIndustriesFn = useServerFn(mk9ListChecklistIndustries);
  const diagnosisFn = useServerFn(getCleanupDiagnosis);
  const executeFn = useServerFn(executeGranularCleanup);

  const industriesQ = useQuery({ 
    queryKey: ["mk9-industries"], 
    queryFn: () => listIndustriesFn() 
  });

  const diagnosisMut = useMutation({
    mutationFn: (data: any) => diagnosisFn({ data }),
    onSuccess: (res: any) => {
      toast.success("Análise do PDF concluída");
      // Seleção recomendada automática baseada no motor do PDF
      setSelections({
        importIds: res.sources.imports.map((i: any) => i.id),
        visitIds: res.sources.visits.map((v: any) => v.id),
        frequencyIds: res.sources.frequencies
          .filter((f: any) => f.source_type === 'IMPORT' || f.source_type === 'SYSTEM')
          .map((f: any) => f.id),
        projectionIds: res.sources.projections.map((p: any) => p.id),
        routeIds: [] // Nunca seleciona rota automaticamente
      });
    },
    onError: (err: any) => toast.error("Falha na análise: " + err.message)
  });

  const executeMut = useMutation({
    mutationFn: (data: any) => executeFn({ data }),
    onSuccess: (res: any) => {
      toast.success("Limpeza executada com sucesso!", {
        description: `Antes: ${res.before.contracted}c/${res.before.actual}r. Depois: ${res.after.contracted}c/${res.after.actual}r.`
      });
      diagnosisMut.mutate({ industryId, month, year }); 
      setConfirmOpen(false);
      setJustification("");
    },
    onError: (err: any) => toast.error("Falha na limpeza: " + err.message)
  });

  const diagnosis = diagnosisMut.data;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <Card className="glass-panel border-amber-500/20 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" />
            Limpeza Baseada no Motor do PDF (ADMIN)
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
                  {(industriesQ.data ?? []).map(i => (
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
              <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="bg-background/50" />
            </div>
          </div>

          <Button 
            onClick={() => diagnosisMut.mutate({ industryId, month, year })} 
            disabled={!industryId || diagnosisMut.isPending}
            className="w-full md:w-auto"
          >
            {diagnosisMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Analisar dados usados no PDF
          </Button>
        </CardContent>
      </Card>

      {diagnosis && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
          {/* Snapshots Comparativos se houver dados de execução anterior */}
          {executeMut.data && (
            <Card className="glass-panel border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase flex items-center gap-2 text-emerald-700">
                  <CheckCircle className="h-4 w-4" /> Comparação Pós-Limpeza
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase">Contratadas Antes</p>
                    <p className="text-lg font-bold">{executeMut.data.before.contracted} → {executeMut.data.after.contracted}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase">Realizadas Antes</p>
                    <p className="text-lg font-bold text-red-600">{executeMut.data.before.actual} → {executeMut.data.after.actual}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="glass-panel border-sky-500/20 bg-sky-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-sky-700 dark:text-sky-400">
                <FileText className="h-4 w-4" /> Resumo Atual no Relatório (PDF)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-background/50 border border-sky-500/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Contratadas</p>
                  <p className="text-2xl font-bold">{diagnosis.report.totals.contracted}</p>
                </div>
                <div className="p-4 rounded-xl bg-background/50 border border-sky-500/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Realizadas</p>
                  <p className="text-2xl font-bold">{diagnosis.report.totals.actual}</p>
                </div>
                <div className="p-4 rounded-xl bg-background/50 border border-sky-500/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Lojas no PDF</p>
                  <p className="text-2xl font-bold">{diagnosis.report.storesCount}</p>
                </div>
                <div className="p-4 rounded-xl bg-background/50 border border-sky-500/10">
                  <p className="text-[10px] text-muted-foreground uppercase">Período Real</p>
                  <p className="text-xs font-medium mt-1">{diagnosis.period.startDate} a {diagnosis.period.endDate}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Fontes Encontradas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <SourceStat label="Visitas" count={diagnosis.sources.visits.length} selected={selections.visitIds.length} />
                    <SourceStat label="Frequências" count={diagnosis.sources.frequencies.length} selected={selections.frequencyIds.length} />
                    <SourceStat label="Importações" count={diagnosis.sources.imports.length} selected={selections.importIds.length} />
                    <SourceStat label="Projeções" count={diagnosis.sources.projections.length} selected={selections.projectionIds.length} />
                    <SourceStat label="Roteiros" count={diagnosis.sources.routes.length} selected={selections.routeIds.length} />
                  </div>

                  <Tabs defaultValue="visits">
                    <TabsList className="bg-background/50">
                      <TabsTrigger value="visits">Visitas ({diagnosis.sources.visits.length})</TabsTrigger>
                      <TabsTrigger value="frequencies">Frequências ({diagnosis.sources.frequencies.length})</TabsTrigger>
                      <TabsTrigger value="imports">Importações ({diagnosis.sources.imports.length})</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="visits" className="pt-4">
                      <div className="max-h-[400px] overflow-auto border rounded-lg divide-y bg-background/30">
                        {diagnosis.sources.visits.length === 0 && <p className="p-4 text-center text-muted-foreground text-xs">Nenhuma visita encontrada.</p>}
                        {diagnosis.sources.visits.map((v: any) => (
                          <div key={v.id} className="p-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={selections.visitIds.includes(v.id)} 
                                onCheckedChange={(checked) => {
                                  setSelections(prev => ({
                                    ...prev,
                                    visitIds: checked 
                                      ? [...prev.visitIds, v.id] 
                                      : prev.visitIds.filter(id => id !== v.id)
                                  }));
                                }}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{v.scheduled_date}</span>
                                <span className="text-[10px] text-muted-foreground">ID: {v.id.slice(0,8)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                               {v.source_import_id && <Badge variant="secondary" className="text-[8px]">CHECKLIST</Badge>}
                               <Badge variant="outline" className="text-[9px] bg-background">Loja: {v.store_id.slice(0,8)}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="frequencies" className="pt-4">
                      <div className="max-h-[400px] overflow-auto border rounded-lg divide-y bg-background/30">
                        {diagnosis.sources.frequencies.length === 0 && <p className="p-4 text-center text-muted-foreground text-xs">Nenhuma frequência encontrada.</p>}
                        {diagnosis.sources.frequencies.map((f: any) => (
                          <div key={f.id} className="p-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={selections.frequencyIds.includes(f.id)} 
                                onCheckedChange={(checked) => {
                                  setSelections(prev => ({
                                    ...prev,
                                    frequencyIds: checked 
                                      ? [...prev.frequencyIds, f.id] 
                                      : prev.frequencyIds.filter(id => id !== f.id)
                                  }));
                                }}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">Vigência: {f.valid_from} {f.valid_until ? `até ${f.valid_until}` : '(Aberta)'}</span>
                                <span className="text-[10px] text-muted-foreground">Tipo: {f.source_type}</span>
                              </div>
                            </div>
                            {f.archived_at ? <Badge variant="outline" className="text-red-500">Arquivada</Badge> : <Badge variant="outline" className="text-emerald-500">Ativa</Badge>}
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="imports" className="pt-4">
                      <div className="max-h-[400px] overflow-auto border rounded-lg divide-y bg-background/30">
                        {diagnosis.sources.imports.length === 0 && <p className="p-4 text-center text-muted-foreground text-xs">Nenhuma importação relacionada.</p>}
                        {diagnosis.sources.imports.map((i: any) => (
                          <div key={i.id} className="p-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={selections.importIds.includes(i.id)} 
                                onCheckedChange={(checked) => {
                                  setSelections(prev => ({
                                    ...prev,
                                    importIds: checked 
                                      ? [...prev.importIds, i.id] 
                                      : prev.importIds.filter(id => id !== i.id)
                                  }));
                                }}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium truncate max-w-[240px]">{i.filename}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground">{new Date(i.started_at).toLocaleString('pt-BR')}</span>
                                </div>
                              </div>
                            </div>
                            <Badge variant={i.status === 'reverted' ? 'destructive' : 'outline'}>{i.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            <Card className="glass-panel border-amber-500/20 h-fit sticky top-24">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Ação de Limpeza
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <h4 className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-400">Prévia de impacto</h4>
                  <ul className="space-y-1.5">
                    <ImpactItem label="Visitas serão removidas" count={selections.visitIds.length} />
                    <ImpactItem label="Frequências serão arquivadas" count={selections.frequencyIds.length} />
                    <ImpactItem label="Importações invalidadas" count={selections.importIds.length} />
                    <ImpactItem label="Projeções reiniciadas" count={selections.projectionIds.length} />
                  </ul>
                  {selections.visitIds.length === 0 && selections.frequencyIds.length === 0 && (
                     <p className="text-[10px] text-muted-foreground italic">Selecione ao menos um registro para limpar.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center justify-between">
                    Justificativa obrigatória
                    <span className={cn("text-[8px]", justification.length >= 10 ? "text-emerald-500" : "text-amber-500")}>
                      {justification.length}/10 mín.
                    </span>
                  </label>
                  <textarea 
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Descreva o motivo desta limpeza para o log de auditoria..."
                    className="w-full h-24 p-3 text-xs rounded-lg bg-background border border-input focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <Button 
                  variant="destructive" 
                  className="w-full shadow-lg shadow-red-500/10 h-12"
                  disabled={justification.length < 10 || Object.values(selections).every(s => s.length === 0) || executeMut.isPending}
                  onClick={() => setConfirmOpen(true)}
                >
                  {executeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Confirmar e Limpar Fontes
                </Button>
                
                <p className="text-[9px] text-center text-muted-foreground px-2">
                  A limpeza utiliza o trace do motor oficial do relatório PDF para garantir que os números sejam zerados.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="glass-panel">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 font-bold">
              <AlertTriangle className="h-6 w-6" /> ATENÇÃO: Ação Irreversível
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-xs text-red-600 space-y-2">
                <p className="font-bold">Você está prestes a limpar os dados de: {diagnosis?.report.storesCount} lojas.</p>
                <p>Esta ação apagará fisicamente as visitas selecionadas e arquivará as versões de frequência, afetando o relatório e o faturamento.</p>
              </div>
              <p className="text-xs text-muted-foreground">Deseja prosseguir com a limpeza administrativa e registrar no log de auditoria?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => executeMut.mutate({
              industryId, month, year, justification, selections
            })} className="bg-red-600 hover:bg-red-700 rounded-xl px-6 h-10">
              Sim, executar limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SourceStat({ label, count, selected }: { label: string, count: number, selected: number }) {
  return (
    <div className={cn(
      "p-3 rounded-xl border text-center transition-all",
      selected > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-background/40 border-border"
    )}>
      <p className="text-[9px] text-muted-foreground uppercase font-bold">{label}</p>
      <p className="text-base font-bold my-0.5">{count}</p>
      <p className={cn("text-[9px] font-medium", selected > 0 ? "text-amber-600" : "text-muted-foreground")}>
        {selected} marcados
      </p>
    </div>
  );
}

function ImpactItem({ label, count }: { label: string, count: number }) {
  if (count === 0) return null;
  return (
    <li className="flex items-center justify-between text-[11px] animate-in fade-in slide-in-from-left-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-amber-700 dark:text-amber-400">{count}</span>
    </li>
  );
}
