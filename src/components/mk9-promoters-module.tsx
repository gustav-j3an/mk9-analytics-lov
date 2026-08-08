import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  Plus, 
  Search, 
  UserCircle, 
  MapPin,
  Smartphone,
  Edit2,
  Trash2,
} from "lucide-react";
import { PromoterDialog, PromoterDeleteDialog } from "./mk9/promoter-admin-dialogs";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { mk9ListPromoters } from "@/lib/mk9-data.functions";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { 
  Mk9PageHeader, 
  Mk9MetricCard, 
  Mk9Panel, 
  Mk9Badge 
} from "./mk9/design-system";


export function Mk9PromotersModule() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPromoter, setEditingPromoter] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "deleted">("active");

  const queryClient = useQueryClient();
  const session = useMk9Session();
  const isAdmin = session.hasRole("ADMIN");

  const listFn = useServerFn(mk9ListPromoters);

  const { data, isLoading } = useQuery({
    queryKey: ["mk9-promoters"],
    queryFn: () => listFn(),
  });

  const filtered = (data ?? []).filter((p: any) => {
    const isDeleted = Boolean(p.archived_at);
    if (statusFilter === "active" && isDeleted) return false;
    if (statusFilter === "deleted" && !isDeleted) return false;

    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.employeeNumber?.toLowerCase().includes(term) ?? false) ||
      (p.city?.toLowerCase().includes(term) ?? false) ||
      (p.uf?.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <Mk9PageHeader 
        title="Gestão de Promotores" 
        subtitle="Administração da equipe de campo e acessos"
        icon={Users}
        actions={
          isAdmin && (
            <Button onClick={() => { setEditingPromoter(null); setDialogOpen(true); }} className="gap-2 bg-command-purple hover:bg-command-purple/90 text-white border-none shadow-lg shadow-purple-500/20">
              <Plus className="h-4 w-4" />
              Novo Promotor
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Mk9MetricCard label="Total" value={data?.length ?? 0} color="blue" />
        <Mk9MetricCard label="Ativos" value={data?.filter(p => !p.archivedAt).length ?? 0} color="emerald" />
        <Mk9MetricCard label="UFs" value={new Set(data?.map(p => p.uf).filter(Boolean)).size} color="purple" />
        <Mk9MetricCard label="Supervisores" value={new Set(data?.map(p => p.supervisorId).filter(Boolean)).size} color="amber" />
      </div>

      <Mk9Panel>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)} className="w-full md:w-auto">
              <TabsList className="bg-command-deep border border-white/5 p-1">
                <TabsTrigger value="active" className="data-[state=active]:bg-command-purple data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest">Ativos</TabsTrigger>
                <TabsTrigger value="deleted" className="data-[state=active]:bg-command-purple data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest">Excluídos</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Buscar por nome, matrícula, cidade ou UF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-command-deep border-white/10 text-white"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 overflow-hidden">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="hover:bg-transparent border-white/5">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Promotor</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Matrícula</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">UF / Cidade</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">App / Dispositivo</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</TableHead>
                {isAdmin && <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-white/5">
                    <TableCell><Skeleton className="h-5 w-48 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40 bg-white/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 bg-white/5" /></TableCell>
                    {isAdmin && <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto bg-white/5" /></TableCell>}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="h-32 text-center text-slate-500 italic">
                    Nenhum promotor encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p: any) => (
                  <TableRow key={p.id} className="group transition-colors border-white/5 hover:bg-white/[0.02]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                          <UserCircle className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-bold text-white uppercase tracking-tight">{p.name}</div>
                          <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">ID: {p.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-emerald-400 font-mono">
                      {p.employeeNumber || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        {p.uf || "—"} / {p.city || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <Smartphone className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-slate-600">v2.4.1</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.archivedAt ? (
                        <Mk9Badge variant="danger">Excluído</Mk9Badge>
                      ) : (
                        <Mk9Badge variant="success">Ativo</Mk9Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right flex items-center justify-end gap-1">
                        {!p.archivedAt ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 text-slate-400 hover:text-white"
                              onClick={() => {
                                setEditingPromoter(p);
                                setDialogOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 text-rose-500"
                              onClick={() => {
                                setEditingPromoter(p);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <div className="w-10" />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Mk9Panel>


      <PromoterDialog 
        open={dialogOpen} 
        promoter={editingPromoter} 
        onClose={() => {
          setDialogOpen(false);
          setEditingPromoter(null);
        }} 
      />

      <PromoterDeleteDialog
        open={deleteDialogOpen}
        promoter={editingPromoter}
        onClose={() => {
          setDeleteDialogOpen(false);
          setEditingPromoter(null);
        }}
      />
    </div>
  );
}
