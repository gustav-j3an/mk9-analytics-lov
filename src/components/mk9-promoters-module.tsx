import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  Plus, 
  Search, 
  UserCircle, 
  MapPin,
  Smartphone,
  CheckCircle2,
  Edit2
} from "lucide-react";
import { PromoterDialog } from "./mk9/promoter-admin-dialogs";
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
import { mk9ListPromoters } from "@/lib/mk9-data.functions";

export function Mk9PromotersModule() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromoter, setEditingPromoter] = useState<any>(null);

  const listFn = useServerFn(mk9ListPromoters);
  const { data, isLoading } = useQuery({
    queryKey: ["mk9-promoters"],
    queryFn: () => listFn(),
  });

  const filtered = (data ?? []).filter((p: any) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.city?.toLowerCase().includes(term) ?? false) ||
      (p.uf?.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Promotores</h2>
          <p className="text-muted-foreground">
            Gestão da equipe de campo e dispositivos móveis.
          </p>
        </div>
        <Button onClick={() => { setEditingPromoter(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Promotor
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cidade ou UF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
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
              <TableHead className="text-right">Ações</TableHead>
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
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
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
                        <div className="text-xs text-muted-foreground">ID: {p.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {p.city || "N/A"}, {p.uf || "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Versão:</span> 2.4.1
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-600 border-green-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Ativo
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setEditingPromoter(p);
                        setDialogOpen(true);
                      }}
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

      <PromoterDialog 
        open={dialogOpen} 
        promoter={editingPromoter} 
        onClose={() => {
          setDialogOpen(false);
          setEditingPromoter(null);
        }} 
      />
    </div>
  );
}
