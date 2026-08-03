import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  ShieldAlert, 
  Search, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  History,
  Info
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
import { toast } from "sonner";
import { getCleanupPreview, executeCleanup } from "@/lib/mk9-cleanup.functions";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export function Mk9AdminCleanupModule() {
  const [industryId, setIndustryId] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [justification, setJustification] = useState("");
  const [selectedImports, setSelectedImports] = useState<string[]>([]);
  const [options, setOptions] = useState({
    revertVisits: true,
    archiveFrequencies: true,
    closeFutureVigencies: true,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listIndustriesFn = useServerFn(mk9ListIndustries);
  const previewFn = useServerFn(getCleanupPreview);
  const executeFn = useServerFn(executeCleanup);

  const industriesQ = useQuery({ 
    queryKey: ["mk9-industries"], 
    queryFn: () => listIndustriesFn() 
  });

  const previewMut = useMutation({
    mutationFn: () => previewFn({ data: { industryId, month, year } }),
    onSuccess: (res) => {
      setSelectedImports(res.imports.map(i => i.id));
      toast.success("Prévia de impacto carregada");
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
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                  <History className="h-4 w-4" /> Importações Localizadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-auto pr-2">
                  {previewData.imports.map(imp => (
                    <div key={imp.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/40">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={selectedImports.includes(imp.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedImports([...selectedImports, imp.id]);
                            else setSelectedImports(selectedImports.filter(id => id !== imp.id));
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{imp.filename}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            {new Date(imp.started_at).toLocaleString()} · {imp.status}
                          </p>
                        </div>
                      </div>
                      {imp.is_operational_current && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]">VIGENTE</Badge>
                      )}
                    </div>
                  ))}
                </div>
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
                Esta ação irá remover permanentemente <strong>{previewData?.impact.visits} visitas</strong> e inativar <strong>{previewData?.impact.frequencies} frequências</strong> da indústria <strong>{industries.find(i => i.id === industryId)?.name}</strong> na competência <strong>{MONTHS[month - 1]}/{year}</strong>.
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
    <Card className="glass-panel">
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
