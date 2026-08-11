import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDailies, cancelDaily, deleteDaily, getDailiesExportData } from "@/lib/mk9-freelancer-dailies.functions";
import { listFreelancers } from "@/lib/mk9-freelancers.functions";
import { listSupervisors } from "@/lib/mk9-supervisors.functions";
import { mk9ListIndustries } from "@/lib/mk9-data.functions";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Pencil, 
  XCircle, 
  Eye, 
  FileSpreadsheet, 
  Search, 
  Loader2, 
  Filter,
  ArrowUpRight,
  TrendingUp,
  Users,
  Store,
  Factory
} from "lucide-react";
import { DailyAdminDialog } from "@/components/mk9/daily-admin-dialogs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import * as XLSX from 'xlsx';

export function Mk9DailiesModule() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listDailies);
  const cancelFn = useServerFn(cancelDaily);
  const deleteFn = useServerFn(deleteDaily);
  const exportFn = useServerFn(getDailiesExportData);
  const freelancersFn = useServerFn(listFreelancers);
  const supervisorsFn = useServerFn(listSupervisors);
  const industriesFn = useServerFn(mk9ListIndustries);
  const [showClosing, setShowClosing] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    freelancerId: "all",
    supervisorId: "all",
    status: "all",
    paymentStatus: "all",
    search: ""
  });

  const { data: dailies, isLoading } = useQuery({
    queryKey: ["mk9-freelancer-dailies", filters.startDate, filters.endDate, filters.freelancerId, filters.supervisorId, filters.status, filters.paymentStatus],
    queryFn: () => listFn({ 
      data: { 
        startDate: filters.startDate,
        endDate: filters.endDate,
        freelancerId: filters.freelancerId === "all" ? undefined : filters.freelancerId,
        supervisorId: filters.supervisorId === "all" ? undefined : filters.supervisorId,
        status: filters.status === "all" ? undefined : filters.status,
        paymentStatus: filters.paymentStatus === "all" ? undefined : filters.paymentStatus
      } 
    })
  });

  const freelancersQ = useQuery({ queryKey: ["mk9-freelancers-list"], queryFn: () => freelancersFn() });
  const supervisorsQ = useQuery({ queryKey: ["mk9-supervisors-list"], queryFn: () => supervisorsFn() });
  const industriesQ = useQuery({ queryKey: ["mk9-industries-list"], queryFn: () => industriesFn() });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelFn({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mk9-freelancer-dailies"] });
      toast.success("Diária cancelada");
    }
  });

  const filteredDailies = useMemo(() => {
    if (!dailies) return [];
    if (!filters.search) return dailies;
    const s = filters.search.toLowerCase();
    return dailies.filter((d: any) => 
      d.freelancer?.name?.toLowerCase().includes(s) ||
      d.items?.some((it: any) => 
        it.store?.name?.toLowerCase().includes(s) ||
        it.industry?.name?.toLowerCase().includes(s)
      )
    );
  }, [dailies, filters.search]);

  // KPIs
  const kpis = useMemo(() => {
    if (!dailies) return { count: 0, total: 0, freelancers: 0, stores: 0, toPay: 0, paid: 0 };
    const realized = dailies.filter((d: any) => d.status === 'REALIZADA');
    const total = realized.reduce((acc: number, d: any) => acc + Number(d.amount), 0);
    const toPay = dailies.filter((d: any) => d.payment_status === 'A PAGAR').reduce((acc: number, d: any) => acc + Number(d.amount), 0);
    const paid = dailies.filter((d: any) => d.payment_status === 'PAGO').reduce((acc: number, d: any) => acc + Number(d.amount), 0);
    const uniqueFreelancers = new Set(dailies.map((d: any) => d.freelancer_id)).size;
    const uniqueStores = new Set(dailies.flatMap((d: any) => d.items?.map((it: any) => it.store_id) || [])).size;
    return { count: dailies.length, total, freelancers: uniqueFreelancers, stores: uniqueStores, toPay, paid };
  }, [dailies]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const data = await exportFn({ 
        data: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          freelancerId: filters.freelancerId === "all" ? undefined : filters.freelancerId,
          supervisorId: filters.supervisorId === "all" ? undefined : filters.supervisorId,
          status: filters.status === "all" ? undefined : filters.status,
          paymentStatus: filters.paymentStatus === "all" ? undefined : filters.paymentStatus
        }
      });

      const wb = XLSX.utils.book_new();
      
      const wsSummary = XLSX.utils.json_to_sheet(data.summary);
      XLSX.utils.book_append_sheet(wb, wsSummary, "RESUMO");

      const wsDailies = XLSX.utils.json_to_sheet(data.dailiesList);
      XLSX.utils.book_append_sheet(wb, wsDailies, "DIÁRIAS");

      const wsItems = XLSX.utils.json_to_sheet(data.itemsList);
      XLSX.utils.book_append_sheet(wb, wsItems, "ATENDIMENTOS");

      XLSX.writeFile(wb, `DIARIAS - ${filters.startDate} A ${filters.endDate}.xlsx`);
      toast.success("Excel gerado com sucesso");
    } catch (err: any) {
      toast.error("Erro ao exportar: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Controle de Diárias</h2>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Gestão de Freelancers e Atendimentos Avulsos</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none border-command-purple/50 text-command-purple hover:bg-command-purple/10" onClick={() => setShowClosing(true)}>
            <TrendingUp className="w-4 h-4 mr-2" /> [ FECHAMENTO ]
          </Button>
          <Button variant="outline" className="flex-1 md:flex-none border-white/10 hover:bg-white/5 text-slate-300" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Exportar Excel
          </Button>
          <Button className="flex-1 md:flex-none bg-command-purple hover:bg-command-purple/80 font-bold" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nova Diária
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Total no Período" value={kpis.count} icon={ArrowUpRight} />
        <KPICard label="Valor Total" value={`R$ ${kpis.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-emerald-400" />
        <KPICard label="A PAGAR" value={`R$ ${kpis.toPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-amber-400" />
        <KPICard label="PAGO" value={`R$ ${kpis.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-blue-400" />
        <KPICard label="Freelancers" value={kpis.freelancers} icon={Users} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Início</label>
          <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="h-9 bg-black/40 border-white/10 text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Fim</label>
          <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="h-9 bg-black/40 border-white/10 text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Freelancer</label>
          <Select value={filters.freelancerId} onValueChange={(val) => setFilters({ ...filters, freelancerId: val })}>
            <SelectTrigger className="h-9 bg-black/40 border-white/10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {freelancersQ.data?.map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Status</label>
          <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
            <SelectTrigger className="h-9 bg-black/40 border-white/10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PLANEJADA">PLANEJADA</SelectItem>
              <SelectItem value="REALIZADA">REALIZADA</SelectItem>
              <SelectItem value="CANCELADA">CANCELADA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Financeiro</label>
          <Select value={filters.paymentStatus} onValueChange={(val) => setFilters({ ...filters, paymentStatus: val })}>
            <SelectTrigger className="h-9 bg-black/40 border-white/10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="A PAGAR">A PAGAR</SelectItem>
              <SelectItem value="PAGO">PAGO</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Freelancer, loja ou indústria..." 
              value={filters.search} 
              onChange={(e) => setFilters({ ...filters, search: e.target.value })} 
              className="pl-9 h-9 bg-black/40 border-white/10 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-xl bg-[#111122] overflow-hidden">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Data</TableHead>
              <TableHead className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Freelancer</TableHead>
              <TableHead className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Atendimentos</TableHead>
              <TableHead className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Valor</TableHead>
              <TableHead className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Financeiro</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-[10px] uppercase tracking-widest px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500 italic">Carregando diárias...</TableCell>
              </TableRow>
            ) : filteredDailies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500 italic">Nenhuma diária encontrada para os filtros aplicados.</TableCell>
              </TableRow>
            ) : (
              filteredDailies.map((d: any) => (
                <TableRow key={d.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                  <TableCell className="text-slate-300 font-medium py-4">{new Date(d.date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-white font-bold">{d.freelancer?.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-slate-400">
                        {new Set(d.items?.map((it: any) => it.store_id)).size} lojas
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {d.items?.length} indústrias
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-white font-mono text-xs">
                    R$ {Number(d.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-black uppercase border-none",
                      d.status === 'REALIZADA' ? "bg-emerald-500/10 text-emerald-400" :
                      d.status === 'PLANEJADA' ? "bg-blue-500/10 text-blue-400" :
                      "bg-rose-500/10 text-rose-400"
                    )}>
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-black uppercase border-none",
                      d.payment_status === 'PAGO' ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"
                    )}>
                      {d.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-6 space-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => setViewing(d)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => { setEditing(d); setOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {d.status !== 'CANCELADA' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-400" onClick={() => {
                        if (confirm("Deseja realmente cancelar esta diária?")) cancelMutation.mutate(d.id);
                      }}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DailyAdminDialog open={open} onOpenChange={setOpen} daily={editing} />
      
      {/* Detail Sheet */}
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="sm:max-w-md bg-command-deep border-white/10 text-white overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-black text-white tracking-tighter uppercase">Detalhe da Diária</SheetTitle>
            <SheetDescription className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Visualização completa do atendimento</SheetDescription>
          </SheetHeader>
          
          {viewing && (
            <div className="mt-8 space-y-8 pb-12">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Freelancer</label>
                  <p className="text-sm font-bold text-white">{viewing.freelancer?.name}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Data</label>
                  <p className="text-sm font-bold text-white">{new Date(viewing.date).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Valor</label>
                  <p className="text-sm font-bold text-emerald-400">R$ {Number(viewing.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Status</label>
                  <p className="text-sm font-bold">{viewing.status}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Supervisor</label>
                  <p className="text-sm font-bold text-slate-300">{viewing.supervisor?.name || "Não informado"}</p>
                </div>
              </div>

              {viewing.notes && (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Observações</label>
                  <p className="text-xs text-slate-400 leading-relaxed italic">"{viewing.notes}"</p>
                </div>
              )}

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-command-purple uppercase tracking-[0.2em]">Atendimentos Realizados</label>
                <div className="space-y-3">
                  {/* Group items by store for display */}
                  {Object.values(viewing.items.reduce((acc: any, it: any) => {
                    if (!acc[it.store_id]) acc[it.store_id] = { store: it.store, industries: [] };
                    acc[it.store_id].industries.push(it.industry);
                    return acc;
                  }, {})).map((group: any, idx: number) => (
                    <div key={idx} className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-white">{group.store?.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-5">
                        {group.industries.map((ind: any, i: number) => (
                          <Badge key={i} variant="secondary" className="bg-command-purple/10 text-command-purple border-none text-[9px] font-bold py-0.5">
                            {ind?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <BiWeeklyClosingPanel open={showClosing} onOpenChange={setShowClosing} />
    </div>
  );
}

function BiWeeklyClosingPanel({ open, onOpenChange }: any) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listDailies);
  const markPaidFn = useServerFn(require('@/lib/mk9-freelancer-dailies.functions').markAsPaid);
  const [closingFilters, setClosingFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: dailies, isLoading } = useQuery({
    queryKey: ["mk9-closing-dailies", closingFilters.startDate, closingFilters.endDate],
    queryFn: () => listFn({ 
      data: { 
        startDate: closingFilters.startDate,
        endDate: closingFilters.endDate,
        paymentStatus: 'A PAGAR'
      } 
    }),
    enabled: open
  });

  const markMutation = useMutation({
    mutationFn: (ids: string[]) => markPaidFn({ data: { dailyIds: ids, paymentDate } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mk9-freelancer-dailies"] });
      queryClient.invalidateQueries({ queryKey: ["mk9-closing-dailies"] });
      toast.success("Pagamento registrado com sucesso!");
    },
    onError: (err: any) => toast.error("Erro ao registrar: " + err.message)
  });

  const totals = useMemo(() => {
    if (!dailies) return { count: 0, amount: 0 };
    return {
      count: dailies.length,
      amount: dailies.reduce((acc: number, d: any) => acc + Number(d.amount), 0)
    };
  }, [dailies]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-command-deep border-white/10 text-white overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-black text-white tracking-tighter uppercase">Fechamento Financeiro</SheetTitle>
          <SheetDescription className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Liquidação de diárias em lote</SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Início do Período</label>
              <Input type="date" value={closingFilters.startDate} onChange={(e) => setClosingFilters({ ...closingFilters, startDate: e.target.value })} className="h-9 bg-black/40 border-white/10 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Fim do Período</label>
              <Input type="date" value={closingFilters.endDate} onChange={(e) => setClosingFilters({ ...closingFilters, endDate: e.target.value })} className="h-9 bg-black/40 border-white/10 text-xs" />
            </div>
          </div>

          <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-2">
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em]">Pendente no Período</p>
            <p className="text-4xl font-black text-white tracking-tighter">R$ {totals.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-amber-500/80 font-medium">{totals.count} diárias aguardando pagamento</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="bg-white/5 border-white/10" />
            </div>

            <Button 
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 font-bold text-white uppercase tracking-widest text-xs"
              disabled={totals.count === 0 || markMutation.isPending}
              onClick={() => {
                if(confirm(`Confirmar liquidação de R$ ${totals.amount.toLocaleString('pt-BR')} para ${totals.count} diárias?`)) {
                  markMutation.mutate(dailies.map((d: any) => d.id));
                }
              }}
            >
              {markMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Marcar como Pago (Em Lote)"}
            </Button>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Resumo por Freelancer</label>
            <div className="space-y-2">
              {isLoading ? <p className="text-xs text-slate-500 italic">Carregando...</p> : 
               Object.values(dailies?.reduce((acc: any, d: any) => {
                 if(!acc[d.freelancer_id]) acc[d.freelancer_id] = { name: d.freelancer.name, count: 0, amount: 0 };
                 acc[d.freelancer_id].count++;
                 acc[d.freelancer_id].amount += Number(d.amount);
                 return acc;
               }, {}) || {}).map((f: any, i: number) => (
                 <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                   <div>
                     <p className="text-xs font-bold text-white">{f.name}</p>
                     <p className="text-[10px] text-slate-500">{f.count} diárias</p>
                   </div>
                   <p className="text-sm font-mono font-bold text-amber-400">R$ {f.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
               ))
              }
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}


function KPICard({ label, value, icon: Icon, color = "text-white" }: any) {
  return (
    <div className="p-5 bg-[#111122] border border-white/5 rounded-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
        <Icon size={48} />
      </div>
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={cn("text-xl font-black tracking-tighter", color)}>{value}</p>
    </div>
  );
}
