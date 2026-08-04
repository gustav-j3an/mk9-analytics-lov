import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  Plus, 
  Search, 
  Factory, 
  Edit2, 
  Archive, 
  RefreshCcw, 
  Info,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Indústrias</h2>
          <p className="text-muted-foreground">
            Gestão cadastral e operacional das indústrias parceiras.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Indústria
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
          {(["active", "archived", "all"] as IndustryStatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === f 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "active" ? "Ativas" : f === "archived" ? "Arquivadas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Indústria</TableHead>
              <TableHead>Status Checklist</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Status Geral</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Nenhuma indústria encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ind) => (
                <TableRow key={ind.id} className="group transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Factory className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{ind.name}</div>
                        {ind.displayName && (
                          <div className="text-xs text-muted-foreground">{ind.displayName}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {ind.requiresChecklist ? (
                      <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-600 border-green-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 bg-muted text-muted-foreground border-border">
                        <XCircle className="h-3 w-3" />
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {ind.monthlyContractedFrequency ? (
                        <span>{ind.monthlyContractedFrequency} visitas/mês</span>
                      ) : (
                        <span className="text-muted-foreground">Não definido</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {ind.archivedAt ? (
                      <Badge variant="secondary">Arquivada</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">Ativa</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
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
