import { useState } from "react";
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
import { mk9ListChecklistIndustries } from "@/lib/mk9-data.functions";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

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
  const [selectedImports, setSelectedImports] = useState<string[]>([]);
  const [options, setOptions] = useState({
    revertVisits: true,
    archiveFrequencies: true,
    closeFutureVigencies: true,
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
    mutationFn: () => diagnosisFn({ data: { industryId, month, year } }),
    onSuccess: (res: any) => {
      setSelectedImports(res.imports.map((i: any) => i.id));
      toast.success("Diagnóstico concluído");
    }
  });

  const executeMut = useMutation({
    mutationFn: () => executeFn({ 
      data: { 
        industryId, month, year, 
        importIds: selectedImports, 
        justification, 
        options 
      } 
    }),
    onSuccess: (res) => {
      toast.success("Limpeza executada com sucesso", {
        description: `${res.visitsRemoved} visitas removidas, ${res.frequenciesArchived} frequências arquivadas.`
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Card className="glass-panel border-amber-500/20 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" />
            Limpeza Manual por Competência (ADMIN)
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Importações" value={previewData.imports.length} />
            <StatCard label="Visitas Afetadas" value={previewData.impact.visits} tone="red" />
            <StatCard label="Vigências Abertas" value={previewData.impact.futureAffected} tone="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 glass-panel">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                  <History className="h-4 w-4" /> Importações Localizadas
                </CardTitle>
                <div className="flex items-center gap-2">
                   <Badge variant="secondary" className="text-[10px]">{previewData.imports.length} arquivos</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {previewData.imports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/10">
                    <Info className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma importação encontrada</p>
                    <p className="text-[11px] text-muted-foreground/60 max-w-[200px] mt-1">
                      Tente ajustar os filtros ou selecione outra competência.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-auto pr-2">
                    {previewData.imports.map(imp => {
                      const typedImp = imp as any;
                      return (
                        <div 
                          key={typedImp.id} 
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-colors",
                            selectedImports.includes(typedImp.id) ? "bg-amber-50/50 border-amber-200" : "bg-background/40 hover:bg-background/60"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              id={`imp-${typedImp.id}`}
                              checked={selectedImports.includes(typedImp.id)}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedImports([...selectedImports, typedImp.id]);
                                else setSelectedImports(selectedImports.filter(id => id !== typedImp.id));
                              }}
                            />
                            <div className="min-w-0">
                              <label htmlFor={`imp-${typedImp.id}`} className="text-sm font-medium truncate block cursor-pointer">{typedImp.filename}</label>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[10px] text-muted-foreground uppercase">
                                  {new Date(typedImp.started_at).toLocaleString()}
                                </p>
                                <span className="text-muted-foreground/30">·</span>
                                <Badge variant="outline" className={cn(
                                  "text-[9px] h-4 px-1.5 font-bold uppercase",
                                  typedImp.status === 'done' ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200"
                                )}>
                                  {typedImp.status}
                                </Badge>
                              </div>
                              <p className="text-[9px] text-muted-foreground/60 mt-1 font-mono uppercase">ID: {typedImp.id}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-panel border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Opções de Limpeza
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <OptionItem 
                    label="Remover visitas persistidas" 
                    description="Exclui visitas originadas destas importações."
                    checked={options.revertVisits}
                    onChange={v => setOptions({ ...options, revertVisits: v })}
                  />
                  <OptionItem 
                    label="Arquivar frequências" 
                    description="Inativa as versões de frequência geradas."
                    checked={options.archiveFrequencies}
                    onChange={v => setOptions({ ...options, archiveFrequencies: v })}
                  />
                  <OptionItem 
                    label="Corrigir vigências futuras" 
                    description="Impede que os dados afetem os meses seguintes."
                    checked={options.closeFutureVigencies}
                    onChange={v => setOptions({ ...options, closeFutureVigencies: v })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground">Justificativa obrigatória</label>
                  <textarea 
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    className="w-full min-h-[100px] rounded-lg border bg-background/50 p-3 text-sm focus:ring-2 focus:ring-amber-500/50 outline-none resize-none"
                    placeholder="Descreva o motivo da limpeza (ex: erro de importação, planilha errada...)"
                  />
                </div>

                <Button 
                  variant="destructive" 
                  className="w-full shadow-lg shadow-destructive/20"
                  disabled={selectedImports.length === 0 || justification.trim().length < 10 || executeMut.isPending}
                  onClick={() => setConfirmOpen(true)}
                >
                  {executeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Executar Limpeza
                </Button>
              </CardContent>
            </Card>
          </div>
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
                Esta ação irá remover permanentemente <strong>{previewData?.impact.visits} visitas</strong> e inativar <strong>{previewData?.impact.frequencies} frequências</strong> da indústria <strong>{industries.find((i: any) => i.id === industryId)?.name}</strong> na competência <strong>{MONTHS[month - 1]}/{year}</strong>.
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
