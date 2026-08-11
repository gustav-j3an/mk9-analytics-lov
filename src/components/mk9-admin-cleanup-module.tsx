import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldAlert,
  Search,
  Trash2,
  AlertTriangle,
  Loader2,
  FileText,
  Activity,
  CheckCircle,
  Clock,
  Zap,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getCleanupDiagnosis, executeGranularCleanup } from "@/lib/mk9-cleanup.functions";
import { reprocessChecklistPromotion } from "@/lib/mk9-admin.functions";
import { mk9ListChecklistIndustries } from "@/lib/mk9-data.functions";
import {
  Mk9Panel,
  Mk9PageHeader,
  Mk9MetricCard,
  Mk9LoadingState,
  Mk9Badge,
} from "@/components/mk9/design-system";

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

export function Mk9AdminCleanupModule(props: { month: number; year: number }) {
  const [industryId, setIndustryId] = useState("");
  const [month, setMonth] = useState(props.month);
  const [year, setYear] = useState(props.year);

  useEffect(() => {
    setMonth(props.month);
  }, [props.month]);

  useEffect(() => {
    setYear(props.year);
  }, [props.year]);
  const [justification, setJustification] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selections, setSelections] = useState({
    importIds: [] as string[],
    visitIds: [] as string[],
    frequencyIds: [] as string[],
    projectionIds: [] as string[],
    routeIds: [] as string[],
  });

  const listIndustriesFn = useServerFn(mk9ListChecklistIndustries);
  const diagnosisFn = useServerFn(getCleanupDiagnosis);
  const executeFn = useServerFn(executeGranularCleanup);

  const industriesQ = useQuery({
    queryKey: ["mk9-industries-cleanup"],
    queryFn: () => listIndustriesFn(),
  });

  const diagnosisMut = useMutation({
    mutationFn: (data: any) => diagnosisFn({ data }),
    onSuccess: (res: any) => {
      toast.success("Análise operacional concluída");
      setSelections({
        importIds: res.sources.imports.map((i: any) => i.id),
        visitIds: res.sources.visits.map((v: any) => v.id),
        frequencyIds: res.sources.frequencies
          .filter((f: any) => f.source_type === "IMPORT" || f.source_type === "SYSTEM")
          .map((f: any) => f.id),
        projectionIds: res.sources.projections.map((p: any) => p.id),
        routeIds: [],
      });
    },
    onError: (err: any) => toast.error("Falha na análise: " + err.message),
  });

  const executeMut = useMutation({
    mutationFn: (data: any) => executeFn({ data }),
    onSuccess: (res: any) => {
      toast.success("Limpeza executada com sucesso!");
      diagnosisMut.mutate({ industryId, month, year });
      setConfirmOpen(false);
      setJustification("");
    },
    onError: (err: any) => toast.error("Falha na limpeza: " + err.message),
  });

  const diagnosis = diagnosisMut.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Mk9PageHeader
        title="Administração de Dados"
        subtitle="Limpeza granular e manutenção de integridade operacional"
        icon={ShieldAlert}
      />

      <Mk9Panel glass={false} className="bg-amber-500/5 border-amber-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Motor de Limpeza Seletiva
            </h3>
            <p className="text-[10px] text-amber-500/70 font-bold uppercase tracking-widest">
              Atenção: Ações irreversíveis que impactam relatórios PDF
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Indústria Alvo
            </label>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger className="bg-input/50 border-border h-10 text-white">
                <SelectValue placeholder="Selecione a indústria" />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-border">
                {(industriesQ.data ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Competência (Mês)
            </label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="bg-input/50 border-border h-10 text-white uppercase px-3 gap-2 shrink-0 min-w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-command-deep border-border">
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Ano
            </label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-input/50 border-border h-10 text-white"
            />
          </div>
        </div>

        <Button
          onClick={() => diagnosisMut.mutate({ industryId, month, year })}
          disabled={!industryId || diagnosisMut.isPending}
          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 border-none"
        >
          {diagnosisMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Analisar Estrutura de Dados
        </Button>
      </Mk9Panel>

      {diagnosis && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Mk9MetricCard
                label="Visitas em Base"
                value={diagnosis.sources.visits.length}
                icon={Activity}
                color="sky"
              />
              <Mk9MetricCard
                label="Vigências"
                value={diagnosis.sources.frequencies.length}
                icon={Zap}
                color="orange"
              />
              <Mk9MetricCard
                label="Importações"
                value={diagnosis.sources.imports.length}
                icon={FileText}
                color="purple"
              />
            </div>

            <Mk9Panel>
              <Tabs defaultValue="visits">
                <TabsList className="bg-muted/50 border-border p-1 h-12 mb-6">
                  <TabsTrigger
                    value="visits"
                    className="data-[state=active]:bg-mk9-accent-primary data-[state=active]:text-white font-bold uppercase text-[10px] tracking-widest"
                  >
                    Visitas ({diagnosis.sources.visits.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="frequencies"
                    className="data-[state=active]:bg-mk9-accent-primary data-[state=active]:text-white font-bold uppercase text-[10px] tracking-widest"
                  >
                    Frequências ({diagnosis.sources.frequencies.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="imports"
                    className="data-[state=active]:bg-mk9-accent-primary data-[state=active]:text-white font-bold uppercase text-[10px] tracking-widest"
                  >
                    Importações ({diagnosis.sources.imports.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="visits">
                  <div className="max-h-[400px] overflow-auto border border-border/50 rounded-xl divide-y divide-white/[0.02] bg-background/40">
                    {diagnosis.sources.visits.map((v: any) => (
                      <div
                        key={v.id}
                        className="p-4 flex items-center justify-between group hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={selections.visitIds.includes(v.id)}
                            onCheckedChange={(checked) => {
                              setSelections((prev) => ({
                                ...prev,
                                visitIds: checked
                                  ? [...prev.visitIds, v.id]
                                  : prev.visitIds.filter((id) => id !== v.id),
                              }));
                            }}
                            className="border-white/20 data-[state=checked]:bg-mk9-accent-primary"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white uppercase tracking-tight">
                              {v.scheduled_date}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              ID: {v.id.slice(0, 13)}
                            </span>
                          </div>
                        </div>
                        <Mk9Badge className="bg-muted/50 border-border text-muted-foreground">
                          LOJA: {v.store_id.slice(0, 8)}
                        </Mk9Badge>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="frequencies">
                  <div className="max-h-[400px] overflow-auto border border-border/50 rounded-xl divide-y divide-white/[0.02] bg-background/40">
                    {diagnosis.sources.frequencies.map((f: any) => (
                      <div
                        key={f.id}
                        className="p-4 flex items-center justify-between group hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={selections.frequencyIds.includes(f.id)}
                            onCheckedChange={(checked) => {
                              setSelections((prev) => ({
                                ...prev,
                                frequencyIds: checked
                                  ? [...prev.frequencyIds, f.id]
                                  : prev.frequencyIds.filter((id) => id !== f.id),
                              }));
                            }}
                            className="border-white/20 data-[state=checked]:bg-mk9-accent-primary"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white uppercase tracking-tight">
                              VIGÊNCIA: {f.valid_from}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                              {f.source_type}
                            </span>
                          </div>
                        </div>
                        <Mk9Badge variant={f.archived_at ? "danger" : "success"}>
                          {f.archived_at ? "Arquivada" : "Ativa"}
                        </Mk9Badge>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="imports">
                  <div className="max-h-[400px] overflow-auto border border-border/50 rounded-xl divide-y divide-white/[0.02] bg-background/40">
                    {diagnosis.sources.imports.map((i: any) => (
                      <div
                        key={i.id}
                        className="p-4 flex items-center justify-between group hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={selections.importIds.includes(i.id)}
                            onCheckedChange={(checked) => {
                              setSelections((prev) => ({
                                ...prev,
                                importIds: checked
                                  ? [...prev.importIds, i.id]
                                  : prev.importIds.filter((id) => id !== i.id),
                              }));
                            }}
                            className="border-white/20 data-[state=checked]:bg-mk9-accent-primary"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white uppercase tracking-tight truncate max-w-[300px]">
                              {i.filename}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                              Início: {new Date(i.started_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                          <div className="flex items-center gap-2">
                            <Mk9Badge variant={i.status === "reverted" ? "danger" : "info"}>
                              {i.status}
                            </Mk9Badge>
                            {i.is_operational_current && (
                              <Mk9Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                                VIGENTE
                              </Mk9Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                              title="Reprocessar Promoção Operacional"
                              onClick={async () => {
                                const loading = toast.loading("Reprocessando promoção...");
                                try {
                                  const res = await reprocessChecklistPromotion({ data: { importId: i.id } });
                                  if (res.success) {
                                    toast.success("Promoção operacional concluída!", { id: loading });
                                    diagnosisMut.mutate({ industryId, month, year });
                                  } else {
                                    const errorMsg = 'error' in res ? res.error : "Erro desconhecido";
                                    toast.error("Erro: " + errorMsg, { id: loading });
                                  }
                                } catch (e: any) {
                                  toast.error("Falha na comunicação", { id: loading });
                                }
                              }}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>

                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

              </Tabs>
            </Mk9Panel>
          </div>

          <div className="space-y-6">
            <Mk9Panel className="border-rose-500/20 bg-rose-500/5 h-fit sticky top-6">
              <div className="flex items-center gap-2 mb-6">
                <Trash2 className="h-4 w-4 text-rose-500" />
                <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">
                  Sumário de Exclusão
                </h3>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Visitas
                  </span>
                  <span className="text-sm font-black text-white">
                    {selections.visitIds.length}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Frequências
                  </span>
                  <span className="text-sm font-black text-white">
                    {selections.frequencyIds.length}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Importações
                  </span>
                  <span className="text-sm font-black text-white">
                    {selections.importIds.length}
                  </span>
                </div>
              </div>

              <Button
                disabled={
                  selections.visitIds.length === 0 &&
                  selections.frequencyIds.length === 0 &&
                  selections.importIds.length === 0
                }
                onClick={() => setConfirmOpen(true)}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 border-none"
              >
                EXECUTAR LIMPEZA
              </Button>
            </Mk9Panel>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-command-deep border-border text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-500 font-black tracking-tighter uppercase flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Confirmação de Segurança
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs mt-2">
              Você está prestes a remover dados operacionais reais. Esta ação será registrada em log
              de auditoria e impactará todos os relatórios da indústria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Justificativa Operacional *
            </label>
            <Input
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex: Correção de erro na planilha de origem..."
              className="bg-input/50 border-border text-white h-10"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted/50 border-border text-muted-foreground hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={justification.length < 5 || executeMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                executeMut.mutate({
                  industryId,
                  month,
                  year,
                  justification,
                  selections,
                });
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest"
            >
              {executeMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                "Confirmar e Executar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
