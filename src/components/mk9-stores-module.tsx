import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Store, 
  MapPin,
  Building2,
  CheckCircle2,
  Edit2,
  Archive,
  RefreshCcw,
  History
} from "lucide-react";
import { StoreDialog, StoreArchiveDialog } from "./mk9/store-admin-dialogs";
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
import { mk9ListStores } from "@/lib/mk9-data.functions";
import { mk9ReactivateStore } from "@/lib/mk9-stores.functions";
import { useMk9Session } from "@/lib/mk9-auth/session";

export function Mk9StoresModule() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  
  const queryClient = useQueryClient();
  const session = useMk9Session();
  const isAdmin = session.hasRole("ADMIN");

  const listFn = useServerFn(mk9ListStores);
  const reactivateFn = useServerFn(mk9ReactivateStore);

  const { data, isLoading } = useQuery({
    queryKey: ["mk9-stores"],
    queryFn: () => listFn(),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => reactivateFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Loja reativada.");
      queryClient.invalidateQueries({ queryKey: ["mk9-stores"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao reativar loja."),
  });

  const filtered = (data ?? []).filter((s: any) => {
    const isArchived = Boolean(s.archived_at);
    if (statusFilter === "active" && isArchived) return false;
    if (statusFilter === "archived" && !isArchived) return false;

    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.chain?.toLowerCase().includes(term) ?? false) ||
      (s.city?.toLowerCase().includes(term) ?? false) ||
      (s.uf?.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lojas</h2>
          <p className="text-muted-foreground">
            Cadastro de pontos de venda, redes e localizações.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingStore(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Loja
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Ativas</TabsTrigger>
              <TabsTrigger value="archived">Arquivadas</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, rede, cidade ou UF..."
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
              <TableHead>Loja</TableHead>
              <TableHead>Rede / Canal</TableHead>
              <TableHead>Localização</TableHead>
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
                  Nenhuma loja encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s: any) => (
                <TableRow key={s.id} className="group transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Store className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">ID: {s.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {s.chain || "Sem rede"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {s.city || "—"}, {s.uf || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.archived_at ? (
                      <Badge variant="outline" className="gap-1.5 bg-gray-500/10 text-gray-600 border-gray-200">
                        <History className="h-3 w-3" />
                        Arquivada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-600 border-green-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Ativa
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right flex items-center justify-end gap-1">
                      {!s.archived_at ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingStore(s);
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
                              setEditingStore(s);
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
                          className="text-indigo-600"
                          title="Reativar"
                          onClick={() => reactivateMut.mutate(s.id)}
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

      <StoreDialog 
        open={dialogOpen} 
        store={editingStore} 
        onClose={() => {
          setDialogOpen(false);
          setEditingStore(null);
        }} 
      />

      <StoreArchiveDialog
        open={archiveDialogOpen}
        store={editingStore}
        onClose={() => {
          setArchiveDialogOpen(false);
          setEditingStore(null);
        }}
      />
    </div>
  );
}
