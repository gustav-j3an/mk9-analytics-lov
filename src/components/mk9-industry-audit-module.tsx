import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  ShieldCheck, 
  Search, 
  AlertCircle, 
  Info, 
  ClipboardCheck, 
  Database,
  FileText,
  Activity,
  ArrowRight,
  Filter
} from "lucide-react";
import { mk9RunIndustryAudit } from "@/lib/mk9-industries/audit.functions";
import { 
  Mk9Panel, 
  Mk9PageHeader, 
  Mk9LoadingState, 
  Mk9Badge,
  Mk9MetricCard
} from "@/components/mk9/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function Mk9IndustryAuditModule() {
  const auditFn = useServerFn(mk9RunIndustryAudit);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "suggested_fixed" | "suggested_visit">("all");

  const { data: audit, isLoading, error } = useQuery({
    queryKey: ["mk9-industry-audit"],
    queryFn: () => auditFn(),
  });

  if (isLoading) return <Mk9LoadingState message="Realizando auditoria histórica das indústrias..." />;
  if (error) return (
    <div className="p-8 text-center text-rose-500 font-mono">
      <AlertCircle className="mx-auto mb-4 h-8 w-8" />
      <p>Erro ao executar auditoria: {(error as any).message}</p>
    </div>
  );

  const filteredReport = (audit?.fullReport || []).filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === "all") return matchesSearch;
    if (filter === "suggested_fixed") return matchesSearch && r.suggestedMode === "FIXED_OPERATION";
    if (filter === "suggested_visit") return matchesSearch && r.suggestedMode === "VISIT_CONTROLLED";
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Mk9PageHeader
        title="Auditoria de Controle de Indústrias"
        subtitle="Diagnóstico histórico para classificação entre Monitorada vs Fixa"
        icon={ShieldCheck}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Mk9MetricCard
          label="Total Indústrias"
          value={audit?.total || 0}
          icon={Database}
          color="purple"
        />
        <Mk9MetricCard
          label="Visit Controlled (Atual)"
          value={audit?.visitControlledCurrent || 0}
          icon={Activity}
          color="blue"
        />
        <Mk9MetricCard
          label="Sugestão: Fixa"
          value={audit?.suggestions.fixedOperation.length || 0}
          icon={ArrowRight}
          color="orange"
        />
        <Mk9MetricCard
          label="Sugestão: Monitorada"
          value={audit?.suggestions.visitControlled.length || 0}
          icon={ShieldCheck}
          color="emerald"
        />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              className="pl-10 bg-white/[0.03] border-border text-white placeholder:text-slate-600 focus:ring-mk9-accent-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilter("all")}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest border-white/5",
                filter === "all" ? "bg-white/10 text-white" : "text-muted-foreground"
              )}
            >
              Tudo
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilter("suggested_fixed")}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest border-white/5",
                filter === "suggested_fixed" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "text-muted-foreground"
              )}
            >
              Sugestão: Fixa
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilter("suggested_visit")}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest border-white/5",
                filter === "suggested_visit" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "text-muted-foreground"
              )}
            >
              Sugestão: Monitorada
            </Button>
          </div>
        </div>

        <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Indústria</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Histórico Checklist</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Roteiro</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Frequência</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Visitas</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Modelo Atual</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Sugestão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReport.map((r: any) => (
                <TableRow key={r.id} className="border-white/5 group hover:bg-white/[0.02]">
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white group-hover:text-mk9-accent-primary transition-colors">{r.name}</span>
                      {r.archived && <span className="text-[8px] text-rose-500 font-black uppercase">Arquivada</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {r.hasImports && (
                        <div className="flex items-center gap-1.5 text-[9px] text-emerald-400">
                          <ClipboardCheck className="h-3 w-3" /> 
                          <span className="font-bold">IMPORTAÇÕES ENCONTRADAS</span>
                        </div>
                      )}
                      {r.hasSnapshots && (
                        <div className="flex items-center gap-1.5 text-[9px] text-blue-400">
                          <FileText className="h-3 w-3" /> 
                          <span className="font-bold">SNAPSHOTS PDF</span>
                        </div>
                      )}
                      {!r.hasImports && !r.hasSnapshots && (
                        <span className="text-[9px] text-slate-600 font-bold italic">SEM HISTÓRICO DE CHECKLIST</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Mk9Badge variant={r.inRoute ? "info" : "default"}>
                      {r.inRoute ? "PRESENTE" : "—"}
                    </Mk9Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Mk9Badge variant={r.hasFrequencies ? "info" : "default"}>
                      {r.hasFrequencies ? "SIM" : "—"}
                    </Mk9Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Mk9Badge variant={r.hasVisits ? "info" : "default"}>
                      {r.hasVisits ? "SIM" : "—"}
                    </Mk9Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-tighter",
                      r.currentMode === "FIXED_OPERATION" ? "text-orange-500" : "text-blue-500"
                    )}>
                      {r.currentMode === "FIXED_OPERATION" ? "FIXA" : "MONITORADA"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest",
                      r.suggestedMode === "FIXED_OPERATION" 
                        ? "bg-orange-500/10 border-orange-500/20 text-orange-400" 
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    )}>
                      {r.suggestedMode === "FIXED_OPERATION" ? "Sugestão: FIXA" : "Sugestão: MONITORADA"}
                      {r.currentMode !== r.suggestedMode && (
                        <AlertCircle className="h-3 w-3 animate-pulse" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-8 p-6 bg-command-purple/5 border border-command-purple/20 rounded-xl space-y-4">
          <div className="flex items-center gap-2 text-command-purple">
            <Info className="h-5 w-5" />
            <h3 className="font-black uppercase tracking-widest text-xs">Resumo do Diagnóstico</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[11px] leading-relaxed text-muted-foreground">
            <div className="space-y-2">
              <p className="font-bold text-white mb-1 uppercase tracking-tighter underline decoration-command-purple/30">Lógica de Reclassificação:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><span className="text-emerald-400 font-black">VISIT_CONTROLLED</span>: Indústrias com importações de checklist, frequências versionadas, visitas operacionais reais ou snapshots de PDF históricos.</li>
                <li><span className="text-orange-400 font-black">FIXED_OPERATION</span>: Indústrias que existem apenas no roteiro ou cadastro, sem atividade de checklist mensal.</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-white mb-1 uppercase tracking-tighter underline decoration-command-purple/30">Impacto da Classificação:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><span className="text-white font-bold">Monitoradas</span>: Participam do Dashboard Analytics, BI e indicadores de faturamento por visita.</li>
                <li><span className="text-white font-bold">Fixas</span>: Continuam no roteiro e PDF operacional, mas não afetam indicadores globais de cobertura.</li>
              </ul>
            </div>
          </div>
        </div>
      </Mk9Panel>
    </div>
  );
}
