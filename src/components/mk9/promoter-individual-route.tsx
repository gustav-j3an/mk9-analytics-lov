import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Download,
  Info,
  Loader2,
  Search as SearchIcon,
  Users,
} from "lucide-react";
import { Mk9PageHeader, Mk9Panel } from "@/components/mk9/design-system";
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
import { Badge } from "@/components/ui/badge";
import { mk9RoutesListVersioned } from "@/lib/mk9-routes.functions";
import { mk9ListPromoters } from "@/lib/mk9-data.functions";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

const WEEKDAYS_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function PromoterIndividualRoute() {
  const { promoterId } = useParams({ from: '/roteiros/promotor/$promoterId' });
  const navigate = useNavigate();
  const search = useSearch({ from: '/roteiros/promotor/$promoterId' });
  
  const [searchTerm, setSearchTerm] = useState("");
  const referenceDate = search.date || new Date().toISOString().slice(0, 10);

  const listRoutesFn = useServerFn(mk9RoutesListVersioned);
  const listPromotersFn = useServerFn(mk9ListPromoters);

  const routesQ = useQuery({
    queryKey: ["mk9-promoter-route", promoterId, referenceDate],
    queryFn: () => listRoutesFn({ data: { promoterId, referenceDate } }),
  });

  const promotersQ = useQuery({
    queryKey: ["mk9-promoters"],
    queryFn: () => listPromotersFn(),
  });

  const promoter = promotersQ.data?.find((p: any) => p.id === promoterId);

  const matrix = useMemo(() => {
    const data = routesQ.data ?? [];
    // Key: industryId|storeId
    const rows = new Map<string, {
      industryName: string;
      storeName: string;
      storeChain: string | null;
      uf: string | null;
      days: Set<number>;
    }>();

    for (const r of data) {
      const key = `${r.industryId}|${r.storeId}`;
      if (!rows.has(key)) {
        rows.set(key, {
          industryName: r.industryName,
          storeName: r.storeName,
          storeChain: r.storeChain,
          uf: r.storeUf,
          days: new Set(),
        });
      }
      rows.get(key)!.days.add(r.weekday);
    }

    return Array.from(rows.values())
      .sort((a, b) => {
        const indComp = a.industryName.localeCompare(b.industryName, "pt-BR");
        if (indComp !== 0) return indComp;
        return a.storeName.localeCompare(b.storeName, "pt-BR");
      });
  }, [routesQ.data]);

  const filteredMatrix = useMemo(() => {
    if (!searchTerm.trim()) return matrix;
    const q = searchTerm.toLowerCase();
    return matrix.filter(
      (m) =>
        m.industryName.toLowerCase().includes(q) ||
        m.storeName.toLowerCase().includes(q) ||
        (m.storeChain?.toLowerCase().includes(q))
    );
  }, [matrix, searchTerm]);

  const totalVisits = useMemo(() => {
    return matrix.reduce((acc, row) => acc + row.days.size, 0);
  }, [matrix]);

  if (routesQ.isLoading || promotersQ.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse font-black uppercase tracking-widest">
          Carregando Matriz Operacional...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/', search: { module: 'roteiros' } as any })}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="text-[10px] font-black uppercase tracking-widest">Voltar para Gestão</span>
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-foreground uppercase">
                Rota Individual
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                {promoter?.name || "Promotor não encontrado"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-card border border-border px-4 py-2 rounded-xl flex flex-col items-center justify-center min-w-[120px]">
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total de Visitas</span>
            <span className="text-xl font-black text-primary tracking-tighter">{totalVisits}</span>
          </div>

          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Referência</label>
            <div className="relative group">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="date"
                value={referenceDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => navigate({ search: { ...search, date: e.target.value } })}
                className="h-9 pl-9 bg-card border-border/50 text-xs font-bold uppercase tracking-tighter"
              />
            </div>
          </div>

          <Button
            variant="outline"
            disabled
            className="h-10 border-border text-muted-foreground text-[10px] font-black uppercase tracking-widest"
          >
            <Download className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
        </div>
      </div>

      <Mk9Panel className="p-0 overflow-hidden border-border/50">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por loja ou indústria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-10 bg-background border-border/50 text-xs"
            />
          </div>
          
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>Visita Programada</span>
            </div>
            <span>|</span>
            <span>{filteredMatrix.length} Combinações</span>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-[200px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground">Indústria</TableHead>
                <TableHead className="min-w-[250px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground">Loja</TableHead>
                <TableHead className="w-[60px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground text-center">UF</TableHead>
                {WEEKDAYS.slice(1).map((d, i) => (
                  <TableHead key={d} className="w-[60px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground text-center bg-primary/5">
                    {d}
                  </TableHead>
                ))}
                <TableHead className="w-[60px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground text-center bg-primary/5">
                  DOM
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatrix.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Info className="h-5 w-5 opacity-20" />
                      <span className="text-xs font-medium">Nenhuma rota encontrada para os filtros.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMatrix.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-primary/5 transition-colors border-border/40 group">
                    <TableCell className="font-bold text-xs uppercase tracking-tighter text-foreground py-3">
                      {row.industryName}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-foreground uppercase tracking-tight">
                          {row.storeName}
                        </span>
                        {row.storeChain && (
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                            {row.storeChain}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <Badge variant="outline" className="text-[9px] font-black px-1.5 h-5 bg-background border-border/50">
                        {row.uf || "—"}
                      </Badge>
                    </TableCell>
                    {/* Monday to Saturday */}
                    {[1, 2, 3, 4, 5, 6].map((day) => (
                      <TableCell key={day} className={cn(
                        "text-center py-3 border-x border-border/20",
                        row.days.has(day) ? "bg-primary/5" : ""
                      )}>
                        {row.days.has(day) ? (
                          <div className="flex justify-center">
                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_10px_rgba(168,85,247,0.2)] animate-in zoom-in duration-300">
                              <span className="text-xs font-black">✓</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/10 font-black">•</span>
                        )}
                      </TableCell>
                    ))}
                    {/* Sunday */}
                    <TableCell className={cn(
                      "text-center py-3 border-l border-border/20",
                      row.days.has(0) ? "bg-primary/5" : ""
                    )}>
                      {row.days.has(0) ? (
                        <div className="flex justify-center">
                          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                            <span className="text-xs font-black">✓</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/10 font-black">•</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Mk9Panel>

      <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
        <Info className="h-5 w-5 text-primary shrink-0" />
        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
          Esta matriz representa o roteiro planejado vigente na data de referência. 
          As marcações <span className="text-primary font-bold tracking-tight">✓</span> indicam visitas programadas semanais. 
          O total de <span className="text-foreground font-black tracking-tight">{totalVisits} visitas</span> é a soma de todas as ocorrências semanais.
        </p>
      </div>
    </div>
  );
}
