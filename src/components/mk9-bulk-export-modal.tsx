import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  Loader2,
  Search,
  Check,
  FileText,
  Archive,
  AlertCircle,
  Clock,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";
import {
  getBulkExportPreview,
  startBulkExport,
  getBulkExportStatus,
  processBulkExport,
  type BulkExportPreview,
  type BulkExportPreviewItem,
} from "@/lib/mk9-bulk-export.functions";

const MONTHS_PT = [
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

export function BulkExportModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"setup" | "preview" | "processing">("setup");

  // Setup State
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [format, setFormat] = useState<"zip" | "pdf">("zip");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [uf, setUf] = useState("");
  const [checklistOnly, setChecklistOnly] = useState(true);

  // Server Fns
  const industriesFn = useServerFn(mk9ListIndustries);
  const previewFn = useServerFn(getBulkExportPreview);
  const startFn = useServerFn(startBulkExport);
  const statusFn = useServerFn(getBulkExportStatus);
  const processFn = useServerFn(processBulkExport);

  // Queries
  const industriesQ = useQuery({
    queryKey: ["mk9-industries"],
    queryFn: () => industriesFn(),
  });

  const [exportId, setExportId] = useState<string | null>(null);
  const statusQ = useQuery({
    queryKey: ["bulk-export-status", exportId],
    queryFn: () => statusFn({ data: { exportId: exportId! } }),
    enabled: !!exportId && step === "processing",
    refetchInterval: (query) => {
      const data = query.state.data as any;
      if (data?.status === "COMPLETED" || data?.status === "FAILED") return false;
      return 2000;
    },
  });

  // Filtered list
  const filteredIndustries = useMemo(() => {
    let list = industriesQ.data ?? [];
    if (checklistOnly) list = list.filter((i: any) => i.requiresChecklist);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((i: any) => i.name.toLowerCase().includes(s));
    }
    return list;
  }, [industriesQ.data, checklistOnly, search]);

  const toggleAll = () => {
    if (selectedIds.length === filteredIndustries.length) setSelectedIds([]);
    else setSelectedIds(filteredIndustries.map((i: any) => i.id));
  };

  const [preview, setPreview] = useState<BulkExportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  async function handleGeneratePreview(retryIds?: string[]) {
    const idsToFetch = retryIds || selectedIds;
    if (idsToFetch.length === 0) return toast.error("Selecione pelo menos uma indústria");

    setLoadingPreview(true);
    try {
      const res = (await previewFn({
        data: { industryIds: idsToFetch, month, year, filters: { uf: uf || null } },
      })) as BulkExportPreview;

      if (retryIds) {
        setPreview((prev: BulkExportPreview | null) => {
          if (!prev) return res;
          const updatedItems = [...prev.items];
          res.items.forEach((newItem: BulkExportPreviewItem) => {
            const idx = updatedItems.findIndex((i) => i.industryId === newItem.industryId);
            if (idx >= 0) updatedItems[idx] = newItem;
            else updatedItems.push(newItem);
          });

          return {
            ...res,
            selectedCount: prev.selectedCount,
            items: updatedItems,
          };
        });
      } else {
        setPreview(res);
        setStep("preview");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar prévia");
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleRetryErrorItems() {
    if (!preview) return;
    const errorIds = preview.items
      .filter((i: BulkExportPreviewItem) => i.status === "FAILED")
      .map((i: BulkExportPreviewItem) => i.industryId);
    if (errorIds.length > 0) handleGeneratePreview(errorIds);
  }

  async function handleStartExport() {
    try {
      const { exportId: id } = await startFn({
        data: {
          industryIds: selectedIds,
          month,
          year,
          format,
          filters: { uf: uf || null },
        },
      });
      setExportId(id);
      setStep("processing");
      // Trigger background processing
      processFn({ data: { exportId: id } }).catch(console.error);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar exportação");
    }
  }

  const exportData = statusQ.data as any;
  const isFinished = exportData?.status === "COMPLETED";
  const progress =
    exportData?.progress_total > 0
      ? (exportData.progress_current / exportData.progress_total) * 100
      : 0;

  async function handleDownload() {
    if (!exportData?.download_url) return;
    const { mk9AuthHeaders } = await import("@/lib/mk9-auth/fetch-headers");
    // Lovable Cloud storage uses standard signed URLs or public buckets usually.
    // Here we assume it's a relative path in our 'reports' bucket.
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.storage
        .from("reports")
        .createSignedUrl(exportData.download_url, 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (e) {
      toast.error("Erro ao gerar link de download");
    }
  }

  const reset = () => {
    setStep("setup");
    setExportId(null);
    setPreview(null);
    setSelectedIds([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Archive className="mr-2 h-4 w-4" />
          Exportar não atendidas em massa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[100dvh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Exportar lojas não atendidas em massa</DialogTitle>
          <DialogDescription>
            Gere relatórios de lojas sem visitas (contratadas {">"} 0 e realizadas = 0) para
            múltiplas indústrias.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6">


        {step === "setup" && (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Competência</Label>
                <div className="flex gap-2">
                  <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS_PT.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-24"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Formato</Label>
                <RadioGroup
                  value={format}
                  onValueChange={(v: any) => setFormat(v)}
                  className="flex h-10 items-center gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="zip" id="f-zip" />
                    <Label htmlFor="f-zip" className="font-normal">
                      ZIP (Individual)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pdf" id="f-pdf" />
                    <Label htmlFor="f-pdf" className="font-normal">
                      PDF Único
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Indústrias ({selectedIds.length} selecionadas)</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="chk-only"
                      checked={checklistOnly}
                      onCheckedChange={(c) => setChecklistOnly(!!c)}
                    />
                    <Label htmlFor="chk-only" className="text-xs font-normal">
                      Somente com checklist
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                    className="h-7 px-2 text-xs"
                  >
                    {selectedIds.length === filteredIndustries.length
                      ? "Desmarcar todas"
                      : "Selecionar todas"}
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar indústrias..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <ScrollArea className="h-48 rounded-md border bg-muted/20">
                <div className="p-2">
                  {filteredIndustries.map((ind) => (
                    <div
                      key={ind.id}
                      className="flex items-center space-x-2 rounded-sm p-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`ind-${ind.id}`}
                        checked={selectedIds.includes(ind.id)}
                        onCheckedChange={(checked: boolean) => {
                          if (checked) setSelectedIds([...selectedIds, ind.id]);
                          else setSelectedIds(selectedIds.filter((id) => id !== ind.id));
                        }}
                      />
                      <Label
                        htmlFor={`ind-${ind.id}`}
                        className="flex-1 cursor-pointer text-sm font-normal"
                      >
                        {ind.name}
                      </Label>
                    </div>
                  ))}
                  {filteredIndustries.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Nenhuma indústria encontrada.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            </div>
            <DialogFooter className="p-6 pt-4 border-t">

              <Button
                className="w-full"
                onClick={() => handleGeneratePreview()}
                disabled={loadingPreview || selectedIds.length === 0}
              >
                {loadingPreview ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Gerar prévia"
                )}
              </Button>
            </DialogFooter>
          </div>
          </div>
        )}


        {step === "preview" && preview && (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-4 gap-4">
              <PreviewKpi label="Indústrias" value={preview.selectedCount} icon={Archive} />
              <PreviewKpi
                label="Com pendência"
                value={preview.withPendingCount}
                icon={AlertCircle}
                tone="bad"
              />
              <PreviewKpi
                label="Lojas zeradas"
                value={preview.totalUnattendedStores}
                icon={FileText}
              />
              <PreviewKpi label="PDFs p/ gerar" value={preview.pdfCount} icon={Check} tone="good" />
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Detalhamento por Indústria</h4>
              {preview.items.some((i) => i.status === "FAILED") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  onClick={handleRetryErrorItems}
                  disabled={loadingPreview}
                >
                  {loadingPreview ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Clock className="mr-1 h-3 w-3" />
                  )}
                  Tentar novamente todas com erro
                </Button>
              )}
            </div>

            <ScrollArea className="h-64 rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Indústria</th>
                    <th className="p-2 text-center">Contratadas</th>
                    <th className="p-2 text-center">Atendidas</th>
                    <th className="p-2 text-center">Zeradas</th>
                    <th className="p-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item) => (
                    <tr key={item.industryId} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2">
                        <div className="font-medium">{item.industryName}</div>
                        <div className="text-[10px] text-muted-foreground">{item.periodLabel}</div>
                      </td>
                      <td className="p-2 text-center">{item.contractedStores ?? "—"}</td>
                      <td className="p-2 text-center text-emerald-600">
                        {item.attendedStores ?? "—"}
                      </td>
                      <td className="p-2 text-center font-semibold text-rose-600">
                        {item.unattendedStores ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {item.status === "READY" ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              Pronto
                            </Badge>
                          ) : item.status === "EMPTY" ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              Sem pendência
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] text-rose-600"
                                  >
                                    Ver detalhes
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-rose-600">
                                      <AlertCircle className="h-5 w-5" />
                                      Erro: {item.industryName}
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                          Código
                                        </Label>
                                        <div className="font-mono text-sm font-semibold">
                                          {item.errorCode || "ENGINE_ERROR"}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                          Status HTTP
                                        </Label>
                                        <div className="font-mono text-sm font-semibold">
                                          {item.httpStatus || 500}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                          Etapa
                                        </Label>
                                        <div className="text-sm font-semibold">
                                          {item.errorStage || "PREVIEW"}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-1 rounded-md bg-muted/50 p-3">
                                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                        Mensagem
                                      </Label>
                                      <div className="text-sm font-medium leading-relaxed">
                                        {item.errorMessage ||
                                          "Não foi possível calcular o relatório desta indústria."}
                                      </div>
                                    </div>
                                  </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t">

                                    <Button
                                      className="w-full"
                                      onClick={() => handleGeneratePreview([item.industryId])}
                                      disabled={loadingPreview}
                                    >
                                      {loadingPreview ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Clock className="mr-2 h-4 w-4" />
                                      )}
                                      Tentar novamente
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Badge
                                variant="outline"
                                className="bg-rose-50 text-rose-700 border-rose-200 cursor-default"
                              >
                                Erro
                              </Badge>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("setup")}>
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleStartExport}
                disabled={preview.pdfCount === 0 && format === "zip"}
              >
                Gerar relatórios ({preview.pdfCount})
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "processing" && (
          <div className="space-y-8 py-10">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                {isFinished ? (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="h-8 w-8" />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
              </div>

              <h3 className="text-xl font-semibold">
                {isFinished ? "Exportação concluída" : "Gerando relatórios..."}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {isFinished
                  ? `${exportData.total_unattended_stores} lojas zeradas identificadas em ${exportData.industries_with_pending_count} indústrias.`
                  : `Processando ${exportData?.progress_current || 0} de ${exportData?.progress_total || 0} indústrias.`}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Progresso total</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {isFinished ? (
              <Button className="w-full" size="lg" onClick={handleDownload}>
                <Download className="mr-2 h-5 w-5" />
                Baixar arquivo ({format.toUpperCase()})
              </Button>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Isso pode levar alguns instantes. Não feche esta janela.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewKpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: any;
  tone?: "good" | "bad";
}) {
  const toneCls = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "";
  return (
    <div className="rounded-lg border bg-muted/10 p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}
