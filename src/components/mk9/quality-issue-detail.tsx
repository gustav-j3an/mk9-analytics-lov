import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  ExternalLink, 
  AlertTriangle, 
  Info, 
  ShieldAlert,
  Calendar,
  Building2,
  Store,
  User as UserIcon
} from "lucide-react";
import { mk9QualityDetailFn } from "@/lib/mk9-quality.functions";
import { 
  issueTypeLabel, 
  dateTimeLabel, 
  competenceLabel,
  SEVERITY_META
} from "@/lib/mk9-quality/labels";
import { cn } from "@/lib/utils";

interface QualityIssueDetailSheetProps {
  issueId: string | null;
  onClose: () => void;
  onNavigateToEntity?: (type: string, id: string) => void;
}

export function QualityIssueDetailSheet({
  issueId,
  onClose,
  onNavigateToEntity
}: QualityIssueDetailSheetProps) {
  const detailFn = useServerFn(mk9QualityDetailFn);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mk9-quality-detail", issueId],
    queryFn: async () => {
      if (!issueId) return null;
      const res = await detailFn({ data: { id: issueId } });
      
      // Enriquecer nomes se não vierem
      const enrichRes = { ...res };
      const { issue } = enrichRes;
      
      if (issue && (!issue.assignedToName || !issue.industryId || !issue.storeId)) {
        // IDs técnicos por enquanto, nomes serão resolvidos se o detailFn não trouxer
      }
      
      return enrichRes;
    },
    enabled: !!issueId,
  });

  const issue = data?.issue;
  const severity = issue ? SEVERITY_META[issue.severity] : null;

  return (
    <Sheet open={!!issueId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] bg-command-deep border-white/10 text-white p-0">
        <SheetHeader className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2 mb-2">
             <Badge 
               className={cn(
                 "uppercase text-[10px] font-black tracking-widest",
                 severity?.className
               )}
             >
               {issue?.severity}
             </Badge>
             <Badge variant="outline" className="uppercase text-[10px] font-black tracking-widest border-white/10 text-slate-400">
               {issue?.status}
             </Badge>
          </div>
          <SheetTitle className="text-xl font-bold text-white leading-tight">
            {issue ? issueTypeLabel(issue.issueType) : "Carregando..."}
          </SheetTitle>
          <SheetDescription className="text-slate-400 text-sm mt-2">
            {issue?.description}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest">Buscando detalhes...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-rose-500">
              <ShieldAlert className="h-8 w-8" />
              <p className="text-xs font-black uppercase tracking-widest text-center">
                Erro ao carregar<br />detalhe da ocorrência
              </p>
            </div>
          ) : issue ? (
            <div className="space-y-8">
              {/* Informações Principais */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data/Hora</p>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {dateTimeLabel(issue.lastSeenAt)}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Competência</p>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                    {competenceLabel(issue.competenceMonth, issue.competenceYear)}
                  </div>
                </div>
              </div>

              <Separator className="bg-white/5" />

              {/* Entidades Relacionadas */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entidades Envolvidas</h4>
                
                <div className="space-y-3">
                  {/* Indústria */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 group">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-command-purple/20 flex items-center justify-center text-command-purple">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">Indústria</p>
                        <p className="text-sm font-bold truncate max-w-[200px]">
                          {String(issue.evidence?.industryName || issue.industryId || "N/D")}
                        </p>
                      </div>
                    </div>
                    {issue.industryId && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-white"
                        onClick={() => onNavigateToEntity?.('industry', issue.industryId!)}
                      >
                        Ver Indústria
                      </Button>
                    )}
                  </div>

                  {/* Loja */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 group">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                        <Store className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">Loja</p>
                        <p className="text-sm font-bold truncate max-w-[200px]">
                          {String(issue.evidence?.storeName || issue.storeId || "N/D")}
                        </p>
                      </div>
                    </div>
                    {issue.storeId && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-white"
                        onClick={() => onNavigateToEntity?.('store', issue.storeId!)}
                      >
                        Ver Loja
                      </Button>
                    )}
                  </div>

                  {/* Promotor (se houver) */}
                  {issue.promoterId && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 group">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-sky-500/20 flex items-center justify-center text-sky-500">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">Promotor</p>
                            <p className="text-sm font-bold truncate max-w-[200px]">
                              {String(issue.evidence?.promoterName || issue.assignedToName || issue.promoterId || "N/D")}
                            </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sugestão de Ação */}
              {issue.suggestedAction && (
                <div className="p-4 rounded-xl bg-command-purple/10 border border-command-purple/20 space-y-2">
                  <div className="flex items-center gap-2 text-command-purple">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ação Sugerida</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {issue.suggestedAction}
                  </p>
                  
                  {issue.issueType === "OPERATION_PAIR_INTEGRITY" && (
                     <Button 
                       className="w-full mt-2 bg-command-purple hover:bg-command-purple/80 text-white text-[10px] font-black uppercase h-8"
                       onClick={() => onNavigateToEntity?.('routes', '')}
                     >
                       Abrir Roteiros
                     </Button>
                  )}
                </div>
              )}

              {/* ID Técnico para Auditoria */}
              <div className="pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1 text-center">ID de Auditoria</p>
                <p className="text-[10px] font-mono text-slate-600 text-center select-all break-all">
                  {issue.id}
                </p>
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
