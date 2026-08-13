// Mk9RoutesModule — Central de Distribuição de Rotas (MK9 Command Center)
// Unifica a visão de quem possui rota, acesso ao Portal e métricas operacionais.

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarClock,
  Loader2,
  Plus,
  Route as RouteIcon,
  Users,
  Search,
  RefreshCw,
  MapPin,
  MessageSquare,
  ExternalLink,
  Eye,
  Edit2,
  History,
  ShieldCheck,
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { Mk9PageHeader, Mk9Panel, Mk9MetricCard, Mk9Badge, Mk9LoadingState, Mk9EmptyState } from "./mk9/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { mk9ListPromotersWithStats } from "@/lib/mk9-promoters.functions";
import { PromoterDialog, PromoterInviteDialog } from "@/components/mk9/promoter-admin-dialogs";

interface Props {
  promoters: Array<{ id: string; name: string }>;
  stores: Array<{ id: string; name: string; chain: string | null; uf: string | null }>;
  industries: Array<{ id: string; name: string }>;
}

export function Mk9RoutesModule({ promoters: basicPromoters, stores, industries }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [referenceDate, setReferenceDate] = useState(today);
  const [search, setSearch] = useState("");
  const [filterUf, setFilterUf] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const [showCreatePromoter, setShowCreatePromoter] = useState(false);
  const [invitingPromoter, setInvitingPromoter] = useState<any | null>(null);
  const [editingPromoter, setEditingPromoter] = useState<any | null>(null);

  const refDateObj = new Date(referenceDate + "T12:00:00Z");
  const year = refDateObj.getFullYear();
  const month = refDateObj.getMonth() + 1;

  const listStatsFn = useServerFn(mk9ListPromotersWithStats);
  const { data: promoters = [], isLoading, refetch } = useQuery({
    queryKey: ["mk9-routes-distribution-center", year, month, referenceDate],
    queryFn: () => listStatsFn({ data: { year, month, referenceDate } }),
  });

  const filtered = useMemo(() => {
    return promoters.filter((p: any) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesUf = filterUf === "all" || p.uf === filterUf;
      
      let matchesStatus = true;
      if (filterStatus === "no_route") matchesStatus = p.plannedVisits === 0;
      else if (filterStatus === "no_access") matchesStatus = !p.user_id;
      else if (filterStatus === "active") matchesStatus = p.plannedVisits > 0 && !!p.user_id;
      else if (filterStatus === "pending_evidence") matchesStatus = p.pendingEvidences > 0;

      return matchesSearch && matchesUf && matchesStatus;
    });
  }, [promoters, search, filterUf, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: promoters.length,
      withRoute: promoters.filter((p: any) => p.plannedVisits > 0).length,
      withAccess: promoters.filter((p: any) => !!p.user_id).length,
      totalVisits: promoters.reduce((acc: number, p: any) => acc + (p.plannedVisits || 0), 0),
      totalRealized: promoters.reduce((acc: number, p: any) => acc + (p.realizedVisits || 0), 0),
      totalPendingEvidences: promoters.reduce((acc: number, p: any) => acc + (p.pendingEvidences || 0), 0)
    };
  }, [promoters]);

  const ufs = useMemo(() => {
    return Array.from(new Set(promoters.map((p: any) => p.uf).filter(Boolean))).sort() as string[];
  }, [promoters]);

  if (isLoading) return <Mk9LoadingState message="Carregando central de distribuição..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Mk9PageHeader
        title="MK9 Command Center"
        subtitle="Central de Planejamento e Acompanhamento de Rotas"
        icon={RouteIcon}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-9 border-border text-muted-foreground hover:text-foreground hover:bg-accent text-[10px] font-black uppercase tracking-widest"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            <Button
              onClick={() => setShowCreatePromoter(true)}
              className="h-9 bg-primary hover:bg-primary/90 text-foreground font-black uppercase tracking-widest px-6 shadow-lg shadow-primary/20 border-none"
            >
              <Plus className="h-4 w-4 mr-2" /> Novo Promotor
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6">
        <Mk9MetricCard label="Total Agentes" value={stats.total} icon={Users} color="purple" />
        <Mk9MetricCard label="Com Rota" value={stats.withRoute} icon={MapPin} color="emerald" hint={`${stats.total - stats.withRoute} sem rota`} />
        <Mk9MetricCard label="Realizadas" value={stats.totalRealized} icon={ShieldCheck} color="sky" hint={`${stats.totalVisits} programadas`} />
        <Mk9MetricCard label="Evidências Pend." value={stats.totalPendingEvidences} icon={History} color="orange" />
        <Mk9MetricCard label="Acesso Portal" value={stats.withAccess} icon={ShieldCheck} color="purple" hint={`${stats.total - stats.withAccess} sem acesso`} />
      </div>

      <Mk9Panel>
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CalendarClock className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-widest">
            Filtros Operacionais
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Data de Referência
            </label>
            <Input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="h-9 bg-input/50 border-border/50 text-xs text-foreground"
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Busca por Agente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Nome do promotor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-input/50 border-border/50 text-xs text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              UF
            </label>
            <Select value={filterUf} onValueChange={setFilterUf}>
              <SelectTrigger className="h-9 bg-input/50 border-border/50 text-xs text-foreground">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">Todas UFs</SelectItem>
                {ufs.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Status Operacional
            </label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 bg-input/50 border-border/50 text-xs text-foreground">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Com Rota & Acesso</SelectItem>
                <SelectItem value="no_route">Sem Rota Planejada</SelectItem>
                <SelectItem value="no_access">Sem Acesso ao Portal</SelectItem>
                <SelectItem value="pending_evidence">Com Evidência Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                <th className="px-4 py-4 text-left font-black">Promotor / Supervisor</th>
                <th className="px-4 py-4 text-left font-black">UF / Cidade</th>
                <th className="px-4 py-4 text-left font-black">Acesso Portal</th>
                <th className="px-4 py-4 text-left font-black">Visitas (P/R/P)</th>
                <th className="px-4 py-4 text-left font-black">Evidências</th>
                <th className="px-4 py-4 text-right font-black">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <Mk9EmptyState message="Nenhum agente encontrado com os filtros aplicados." />
                  </td>
                </tr>
              ) : (
                filtered.map((p: any) => (
                  <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground group-hover:text-mk9-accent-primary transition-colors">
                          {p.name}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider">
                          {p.supervisorName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-foreground font-bold flex items-center gap-1 uppercase">
                          <MapPin className="h-2.5 w-2.5" /> {p.uf || "—"}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase truncate max-w-[120px]">
                          {p.city || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {p.user_id ? (
                          <Mk9Badge variant="success">
                            <ShieldCheck className="h-3 w-3 mr-1 inline" /> Ativo
                          </Mk9Badge>
                        ) : (
                          <Mk9Badge variant="danger">
                            <ShieldAlert className="h-3 w-3 mr-1 inline" /> Sem Acesso
                          </Mk9Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black text-foreground">{p.plannedVisits}</span>
                          <span className="text-[8px] text-muted-foreground uppercase">Prog</span>
                        </div>
                        <div className="h-4 w-[1px] bg-border/50" />
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black text-emerald-400">{p.realizedVisits}</span>
                          <span className="text-[8px] text-muted-foreground uppercase">Real</span>
                        </div>
                        <div className="h-4 w-[1px] bg-border/50" />
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black text-orange-400">{p.pendingVisits}</span>
                          <span className="text-[8px] text-muted-foreground uppercase">Pend</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {p.pendingEvidences > 0 ? (
                        <Mk9Badge variant="warning">
                          {p.pendingEvidences} Pendentes
                        </Mk9Badge>
                      ) : (
                        <span className="text-[9px] text-muted-foreground uppercase font-bold italic opacity-50">
                          Zerado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-mk9-accent-primary hover:bg-mk9-accent-primary/10"
                          title="Montar Rota"
                          onClick={() => navigate({ to: "/roteiros", search: { promoterId: p.id } })}
                        >
                          <RouteIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-sky-400 hover:bg-sky-400/10"
                          title="Ver Rota (Matriz Semanal)"
                          onClick={() => navigate({ to: `/roteiros/promotor/${p.id}`, search: { date: referenceDate } })}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10"
                          title="Enviar ao Promotor (WhatsApp)"
                          onClick={() => setInvitingPromoter(p)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-orange-400 hover:bg-orange-400/10"
                          title="Acompanhar Execução / Validação"
                          onClick={() => navigate({ to: "/dashboard", search: { module: "validacao", promoterId: p.id } as any })}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Mk9Panel>

      <PromoterDialog
        open={showCreatePromoter || !!editingPromoter}
        onClose={() => {
          setShowCreatePromoter(false);
          setEditingPromoter(null);
          refetch();
        }}
        promoter={editingPromoter}
      />
      <PromoterInviteDialog
        open={!!invitingPromoter}
        onClose={() => setInvitingPromoter(null)}
        promoter={invitingPromoter}
      />
    </div>
  );
}
