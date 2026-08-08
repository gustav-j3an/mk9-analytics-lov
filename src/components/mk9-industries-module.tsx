import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  Plus, 
  Search, 
  Factory, 
  Edit2, 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";
import { 
  IndustryCreateDialog, 
  IndustryEditDialog, 
  IndustryRow 
} from "@/components/mk9/industry-admin-dialogs";
import { matchesStatusFilter, IndustryStatusFilter } from "@/lib/mk9-industries/admin";
import { 
  Mk9PageHeader, 
  Mk9MetricCard, 
  Mk9Panel, 
  Mk9Badge 
} from "./mk9/design-system";


export function Mk9IndustriesModule() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<IndustryStatusFilter>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<IndustryRow | null>(null);

  const listFn = useServerFn(mk9ListIndustries);
  const { data, isLoading } = useQuery({
    queryKey: ["mk9-industries"],
    queryFn: () => listFn(),
  });

  const filtered = (data ?? []).filter((ind) => {
    const matchesSearch = 
      ind.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ind.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    return matchesSearch && matchesStatusFilter(ind, statusFilter);
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <Mk9PageHeader 
        title="Gestão de Indústrias" 
        subtitle="Administração de parceiros e configurações de período"
        icon={Factory}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-command-purple hover:bg-command-purple/90 text-white border-none shadow-lg shadow-purple-500/20">
            <Plus className="h-4 w-4" />
            Nova Indústria
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Mk9MetricCard label="Total" value={data?.length ?? 0} color="blue" />
        <Mk9MetricCard label="Ativas" value={data?.filter(i => !i.archivedAt).length ?? 0} color="emerald" />
        <Mk9MetricCard label="Arquivadas" value={data?.filter(i => !!i.archivedAt).length ?? 0} color="amber" />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-command-deep border-white/10 text-white"
            />
          </div>
          <div className="flex items-center gap-2 bg-command-deep p-1 rounded-xl border border-white/5">
            {(["active", "archived", "all"] as IndustryStatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  statusFilter === f 
                    ? "bg-command-purple text-white shadow-lg shadow-purple-500/20" 
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {f === "active" ? "Ativas" : f === "archived" ? "Arquivadas" : "Todas"}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 overflow-hidden">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="hover:bg-transparent border-white/5">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Indústria</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">CNPJ</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status Checklist</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contrato</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status Geral</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-white/5">
                    <TableCell><Skeleton className="h-5 w-40 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 bg-white/5" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto bg-white/5" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500 italic">
                    Nenhuma indústria encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((ind) => (
                  <TableRow key={ind.id} className="group transition-colors border-white/5 hover:bg-white/[0.02]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-command-purple/10 flex items-center justify-center border border-command-purple/20">
                          <Factory className="h-4 w-4 text-command-purple" />
                        </div>
                        <div>
                          <div className="font-bold text-white uppercase tracking-tight">{ind.name}</div>
                          {ind.displayName && (
                            <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{ind.displayName}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400 font-medium font-mono text-xs">
                      {ind.cnpj || "—"}
                    </TableCell>
                    <TableCell>
                      {ind.requiresChecklist ? (
                        <Mk9Badge variant="success">Checklist ON</Mk9Badge>
                      ) : (
                        <Mk9Badge variant="default">Checklist OFF</Mk9Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-bold text-slate-300">
                        {ind.monthlyContractedFrequency ? (
                          <span>{ind.monthlyContractedFrequency} visitas/mês</span>
                        ) : (
                          <span className="text-slate-500">Não definido</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ind.archivedAt ? (
                        <Mk9Badge variant="warning">Arquivada</Mk9Badge>
                      ) : (
                        <Mk9Badge variant="info">Ativa</Mk9Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 text-slate-400 hover:text-white"
                        onClick={() => setEditingIndustry(ind as IndustryRow)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Mk9Panel>


      <IndustryCreateDialog 
        open={createOpen} 
        onClose={() => setCreateOpen(false)} 
      />
      
      <IndustryEditDialog 
        industry={editingIndustry} 
        onClose={() => setEditingIndustry(null)} 
      />
    </div>
  );
}
