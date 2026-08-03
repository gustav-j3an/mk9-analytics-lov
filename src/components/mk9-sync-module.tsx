import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  RefreshCcw, 
  Cloud, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Clock,
  History,
  ShieldCheck,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export function Mk9SyncModule() {
  const [activeTab, setActiveTab] = useState("history");

  const { data: syncFiles, isLoading, refetch } = useQuery({
    queryKey: ["mk9-sync-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mk9_checklist_sync_files" as any)
        .select(`
          *,
          industry:mk9_industries(id, name)
        `)
        .order("detected_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as any[];
    }
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sincronização Google Drive</h2>
          <p className="text-muted-foreground text-sm">Monitoramento e revisão de arquivos enviados automaticamente pelo n8n.</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="glass-panel">
          <RefreshCcw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Detectado" 
          value={syncFiles?.length ?? 0} 
          icon={Cloud} 
          className="bg-sky-500/5 border-sky-500/20"
        />
        <StatCard 
          label="Importados" 
          value={syncFiles?.filter(f => f.status === 'IMPORTED' || f.status === 'REPLACED_PREVIOUS').length ?? 0} 
          icon={CheckCircle2} 
          className="bg-emerald-500/5 border-emerald-500/20"
        />
        <StatCard 
          label="Revisão Pendente" 
          value={syncFiles?.filter(f => f.status === 'NEEDS_REVIEW').length ?? 0} 
          icon={Search} 
          className="bg-amber-500/5 border-amber-500/20"
        />
        <StatCard 
          label="Falhas" 
          value={syncFiles?.filter(f => f.status === 'FAILED').length ?? 0} 
          icon={AlertCircle} 
          className="bg-red-500/5 border-red-500/20"
        />
      </div>

      <Card className="glass-panel border-muted/20">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-6 pt-6 flex items-center justify-between border-b pb-4">
              <TabsList className="bg-background/50">
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <History className="h-4 w-4" /> Histórico de Sincronização
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Segurança & Configuração
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="history" className="m-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-4 font-medium uppercase text-[10px] tracking-wider text-muted-foreground">Arquivo / Drive</th>
                      <th className="text-left p-4 font-medium uppercase text-[10px] tracking-wider text-muted-foreground">Indústria / Período</th>
                      <th className="text-left p-4 font-medium uppercase text-[10px] tracking-wider text-muted-foreground">Status</th>
                      <th className="text-left p-4 font-medium uppercase text-[10px] tracking-wider text-muted-foreground">Detectado em</th>
                      <th className="text-right p-4 font-medium uppercase text-[10px] tracking-wider text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/10">
                    {syncFiles?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-muted-foreground">
                          Nenhum arquivo sincronizado recentemente.
                        </td>
                      </tr>
                    )}
                    {syncFiles?.map((file) => (
                      <tr key={file.id} className="hover:bg-muted/5 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                              {file.file_name}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                              ID Drive: {file.external_file_id.slice(0, 12)}...
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{file.industry?.name ?? "Não Identificada"}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {file.competence_month ? `${MONTHS[file.competence_month - 1]} / ${file.competence_year}` : "Período pendente"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={file.status} error={file.error_code} />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(file.detected_at).toLocaleString('pt-BR')}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-sky-600" /> Segurança M2M
                  </h3>
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      O MK9 aceita conexões autenticadas via header <code>Authorization: Bearer</code>. 
                      O segredo deve ser configurado como <code>MK9_SYNC_SECRET</code> no Lovable Cloud.
                    </p>
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Endpoint de Sincronização</span>
                      <code className="text-[10px] bg-background p-2 rounded border block break-all">
                        {typeof window !== 'undefined' ? `${window.location.origin}/api/public/sync/checklists` : '/api/public/sync/checklists'}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-sky-600" /> Webhook n8n
                  </h3>
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Configure o n8n para enviar multipart/form-data contendo:
                    </p>
                    <ul className="text-[10px] space-y-1 list-disc list-inside text-muted-foreground">
                      <li><code>file</code>: Buffer do .xlsx</li>
                      <li><code>externalFileId</code>: ID único do Drive</li>
                      <li><code>fileHash</code>: SHA-256 do conteúdo</li>
                      <li><code>modifiedTime</code>: Data ISO-8601</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, className }: any) {
  return (
    <Card className={cn("glass-panel", className)}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-2 rounded-lg bg-background/50 border">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, error }: { status: string, error?: string }) {
  const configs: Record<string, { label: string, color: string }> = {
    'DETECTED': { label: 'Detectado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    'PROCESSING': { label: 'Processando', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20 animate-pulse' },
    'IMPORTED': { label: 'Importado', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    'REPLACED_PREVIOUS': { label: 'Substituído', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
    'SKIPPED_UNCHANGED': { label: 'Inalterado', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
    'NEEDS_REVIEW': { label: 'Revisão', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    'FAILED': { label: 'Falhou', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  };

  const cfg = configs[status] || { label: status, color: 'bg-muted text-muted-foreground' };

  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge variant="outline" className={cn("text-[10px] py-0 px-2", cfg.color)}>
        {cfg.label}
      </Badge>
      {error && <span className="text-[9px] text-red-500 font-medium truncate max-w-[120px]">{error}</span>}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
