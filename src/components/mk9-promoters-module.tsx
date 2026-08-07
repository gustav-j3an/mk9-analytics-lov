import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  UserCircle, 
  MapPin,
  Smartphone,
  CheckCircle2,
  Edit2,
  Archive,
  RefreshCcw,
  History
} from "lucide-react";
import { PromoterDialog, PromoterArchiveDialog } from "./mk9/promoter-admin-dialogs";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { mk9ListPromoters } from "@/lib/mk9-data.functions";
import { mk9ReactivatePromoter } from "@/lib/mk9-promoters.functions";
import { useMk9Session } from "@/lib/mk9-auth/session";

export function Mk9PromotersModule() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [editingPromoter, setEditingPromoter] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");

  const queryClient = useQueryClient();
  const session = useMk9Session();
  const isAdmin = session.hasRole("ADMIN");

  const listFn = useServerFn(mk9ListPromoters);
  const reactivateFn = useServerFn(mk9ReactivatePromoter);

  const { data, isLoading } = useQuery({
    queryKey: ["mk9-promoters"],
    queryFn: () => listFn(),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => reactivateFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Promotor reativado.");
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao reativar promotor."),
  });

  const filtered = (data ?? []).filter((p: any) => {
    const isArchived = Boolean(p.archived_at);
    if (statusFilter === "active" && isArchived) return false;
    if (statusFilter === "archived" && !isArchived) return false;

    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.employeeNumber?.toLowerCase().includes(term) ?? false) ||
      (p.city?.toLowerCase().includes(term) ?? false) ||
      (p.uf?.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Equipe de Campo</h2>
          <p className="text-muted-foreground">
            Gestão da equipe de campo e dispositivos móveis.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingPromoter(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Promotor
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Ativos</TabsTrigger>
              <TabsTrigger value="archived">Arquivados</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, matrícula, cidade ou UF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Promotor</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>App / Dispositivo</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  {isAdmin && <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="h-32 text-center text-muted-foreground">
                  Nenhum promotor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p: any) => (
                <TableRow key={p.id} className="group transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <UserCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>ID: {p.id.slice(0, 8)}</span>
                          {p.employeeNumber && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-border" />
                              <span className="font-medium text-emerald-600">Matrícula: {p.employeeNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {p.city || "—"}, {p.uf || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Versão:</span> 2.4.1
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.archived_at ? (
                      <Badge variant="outline" className="gap-1.5 bg-gray-500/10 text-gray-600 border-gray-200">
                        <History className="h-3 w-3" />
                        Arquivado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-600 border-green-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Ativo
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right flex items-center justify-end gap-1">
                      {!p.archived_at ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
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
                            className="text-destructive"
                            onClick={() => {
                              setEditingPromoter(p);
                              setArchiveDialogOpen(true);
                            }}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-emerald-600"
                          title="Reativar"
                          onClick={() => reactivateMut.mutate(p.id)}
                          disabled={reactivateMut.isPending}
                        >
                          <RefreshCcw className={`h-4 w-4 ${reactivateMut.isPending ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PromoterDialog 
        open={dialogOpen} 
        promoter={editingPromoter} 
        onClose={() => {
          setDialogOpen(false);
          setEditingPromoter(null);
        }} 
      />

      <PromoterArchiveDialog
        open={archiveDialogOpen}
        promoter={editingPromoter}
        onClose={() => {
          setArchiveDialogOpen(false);
          setEditingPromoter(null);
        }}
      />
    </div>
  );
}
