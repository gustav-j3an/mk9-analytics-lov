import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDailies, cancelDaily, deleteDaily, getDailiesExportData, markAsPaid, calculateFinancialTotal } from "@/lib/mk9-freelancer-dailies.functions";
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
import { Label } from "@/components/ui/label";
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
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'),
    endDate: new Date().toLocaleDateString('en-CA'),
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
    
    // REGRA MK9 v2.6.0: Total = Soma dos Atendimentos (Valor Unitário de cada item)
    const calculateTotal = (dailyList: any[]) => dailyList.reduce((acc: number, d: any) => {
      const industryCount = d.items?.length || 0;
      const unitRate = Number(d.amount) || 0;
      return acc + (unitRate * industryCount);
    }, 0);

    const total = calculateTotal(realized);
    const toPay = calculateTotal(dailies.filter((d: any) => d.payment_status === 'A PAGAR'));
    const paid = calculateTotal(dailies.filter((d: any) => d.payment_status === 'PAGO'));
    
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
      const ws = XLSX.utils.json_to_sheet(data.itemsList);

      // Configurar larguras de colunas
      ws['!cols'] = [
        { wch: 12 }, // DATA
        { wch: 25 }, // FREELANCER
        { wch: 15 }, // CPF
        { wch: 15 }, // TELEFONE
        { wch: 25 }, // LOJA
        { wch: 15 }, // REDE
        { wch: 20 }, // CIDADE
        { wch: 5 },  // UF
        { wch: 15 }, // INDÚSTRIA
        { wch: 20 }, // VALOR DO ATENDIMENTO
        { wch: 15 }, // STATUS
        { wch: 18 }, // STATUS FINANCEIRO
        { wch: 18 }, // DATA DE PAGAMENTO
        { wch: 30 }, // OBSERVAÇÃO
      ];

      // Adicionar linha de TOTAL com fórmula
      const rowCount = data.itemsList.length;
      const lastRowIndex = rowCount + 2; // +1 header, +1 para nova linha (1-based)
      
      XLSX.utils.sheet_add_aoa(ws, [
        [null, null, null, null, null, null, null, null, "TOTAL:", { f: `SUM(J2:J${rowCount + 1})`, t: 'n', z: 'R$ #,##0.00' }]
      ], { origin: -1 });

      // Congelar primeira linha e adicionar filtros
      ws['!autofilter'] = { ref: `A1:N${rowCount + 1}` };
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };

      XLSX.utils.book_append_sheet(wb, ws, "ATENDIMENTOS");
      XLSX.writeFile(wb, `MK9_DIARIAS_${filters.startDate}_A_${filters.endDate}.xlsx`);
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
          <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">Controle de Diárias</h2>
          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Gestão de Freelancers e Atendimentos Avulsos</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none border-command-purple/50 text-command-purple hover:bg-primary/10" onClick={() => setShowClosing(true)}>
            <TrendingUp className="w-4 h-4 mr-2" /> [ FECHAMENTO ]
          </Button>
          <Button variant="outline" className="flex-1 md:flex-none border-border hover:bg-muted/50 text-foreground/80" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Exportar Excel
          </Button>
          <Button className="flex-1 md:flex-none bg-primary hover:bg-primary/80 font-bold" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nova Diária
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Total no Período" value={kpis.count} icon={ArrowUpRight} />
        <KPICard label="Valor Total" value={`R$ ${kpis.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-emerald-600 dark:text-emerald-400" />
        <KPICard label="A PAGAR" value={`R$ ${kpis.toPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-amber-600 dark:text-amber-400" />
        <KPICard label="PAGO" value={`R$ ${kpis.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-blue-600 dark:text-blue-400" />
        <KPICard label="Freelancers" value={kpis.freelancers} icon={Users} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-muted/50 border border-border rounded-xl">
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Início</label>
          <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="h-9 bg-background/60 border-border text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Fim</label>
          <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="h-9 bg-background/60 border-border text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Freelancer</label>
          <Select value={filters.freelancerId} onValueChange={(val) => setFilters({ ...filters, freelancerId: val })}>
            <SelectTrigger className="h-9 bg-background/60 border-border text-xs">
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
          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Status</label>
          <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
            <SelectTrigger className="h-9 bg-background/60 border-border text-xs">
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
          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Financeiro</label>
          <Select value={filters.paymentStatus} onValueChange={(val) => setFilters({ ...filters, paymentStatus: val })}>
            <SelectTrigger className="h-9 bg-background/60 border-border text-xs">
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
          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Freelancer, loja ou indústria..." 
              value={filters.search} 
              onChange={(e) => setFilters({ ...filters, search: e.target.value })} 
              className="pl-9 h-9 bg-background/60 border-border text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Data</TableHead>
              <TableHead className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Freelancer</TableHead>
              <TableHead className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Atendimentos</TableHead>
              <TableHead className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Total</TableHead>
              <TableHead className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Financeiro</TableHead>
              <TableHead className="text-right text-muted-foreground font-bold text-[10px] uppercase tracking-widest px-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">Carregando diárias...</TableCell>
              </TableRow>
            ) : filteredDailies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">Nenhuma diária encontrada para os filtros aplicados.</TableCell>
              </TableRow>
            ) : (
              filteredDailies.map((d: any) => (
                <TableRow key={d.id} className="border-border/50 hover:bg-muted/50 transition-colors group">
                  <TableCell className="text-foreground/80 font-medium py-4">{d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</TableCell>
                  <TableCell className="text-foreground font-bold">{d.freelancer?.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        {new Set(d.items?.map((it: any) => it.store_id)).size} lojas
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {d.items?.length} indústrias
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground font-mono text-xs">
                    <div className="flex flex-col">
                      <span className="font-bold">R$ {(Number(d.amount) * (d.items?.length || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <span className="text-[9px] text-muted-foreground uppercase">
                        {d.items?.length || 0} × R$ {Number(d.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setViewing(d)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(d); setOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {d.status !== 'CANCELADA' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-400" onClick={() => {
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
        <SheetContent className="sm:max-w-md bg-background border-border text-foreground overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-black text-foreground tracking-tighter uppercase">Detalhe da Diária</SheetTitle>
            <SheetDescription className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Visualização completa do atendimento</SheetDescription>
          </SheetHeader>
          
          {viewing && (
            <div className="mt-8 space-y-8 pb-12">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Freelancer</label>
                  <p className="text-sm font-bold text-foreground">{viewing.freelancer?.name}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Data</label>
                  <p className="text-sm font-bold text-foreground">{viewing.date ? new Date(viewing.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Valor Total</label>
                  <p className="text-sm font-bold text-emerald-400">R$ {(Number(viewing.amount) * viewing.items.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{viewing.items.length} indústrias × R$ {Number(viewing.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Status</label>
                  <p className="text-sm font-bold">{viewing.status}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Supervisor</label>
                  <p className="text-sm font-bold text-foreground/80">{viewing.supervisor?.name || "Não informado"}</p>
                </div>
              </div>

              {viewing.notes && (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Observações</label>
                  <p className="text-xs text-muted-foreground leading-relaxed italic">"{viewing.notes}"</p>
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
                    <div key={idx} className="p-4 bg-muted/50 border border-border/50 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-bold text-foreground">{group.store?.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-5">
                        {group.industries.map((ind: any, i: number) => (
                          <Badge key={i} variant="secondary" className="bg-primary/10 text-command-purple border-none text-[9px] font-bold py-0.5">
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
  const markPaidFn = useServerFn(markAsPaid);
  const [closingFilters, setClosingFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'),
    endDate: new Date().toLocaleDateString('en-CA'),
  });
  const [paymentDate, setPaymentDate] = useState(new Date().toLocaleDateString('en-CA'));

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
      amount: dailies.reduce((acc: number, d: any) => acc + (Number(d.amount) * (d.items?.length || 0)), 0)
    };
  }, [dailies]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg bg-background border-border text-foreground overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-black text-foreground tracking-tighter uppercase">Fechamento Financeiro</SheetTitle>
          <SheetDescription className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Liquidação de diárias em lote</SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 border border-border rounded-xl">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Início do Período</label>
              <Input type="date" value={closingFilters.startDate} onChange={(e) => setClosingFilters({ ...closingFilters, startDate: e.target.value })} className="h-9 bg-background/60 border-border text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Fim do Período</label>
              <Input type="date" value={closingFilters.endDate} onChange={(e) => setClosingFilters({ ...closingFilters, endDate: e.target.value })} className="h-9 bg-background/60 border-border text-xs" />
            </div>
          </div>

          <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-2">
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em]">Pendente no Período</p>
            <p className="text-4xl font-black text-foreground tracking-tighter">R$ {totals.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-amber-500/80 font-medium">{totals.count} diárias aguardando pagamento</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="bg-muted/50 border-border" />
            </div>

            <Button 
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 font-bold text-foreground uppercase tracking-widest text-xs"
              disabled={totals.count === 0 || markMutation.isPending}
              onClick={() => {
                if(confirm(`Confirmar liquidação de R$ ${totals.amount.toLocaleString('pt-BR')} para ${totals.count} diárias?`)) {
                  markMutation.mutate((dailies || []).map((d: any) => d.id));
                }
              }}
            >
              {markMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Marcar como Pago (Em Lote)"}
            </Button>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Resumo por Freelancer</label>
            <div className="space-y-2">
              {isLoading ? <p className="text-xs text-muted-foreground italic">Carregando...</p> : 
               Object.values((dailies || []).reduce((acc: any, d: any) => {
                 if(!acc[d.freelancer_id]) acc[d.freelancer_id] = { name: d.freelancer.name, count: 0, amount: 0 };
                 acc[d.freelancer_id].count++;
                 acc[d.freelancer_id].amount += Number(d.amount);
                 return acc;
               }, {}) || {}).map((f: any, i: number) => (
                 <div key={i} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/50">
                   <div>
                     <p className="text-xs font-bold text-foreground">{f.name}</p>
                     <p className="text-[10px] text-muted-foreground">{f.count} diárias</p>
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


function KPICard({ label, value, icon: Icon, color = "text-foreground" }: any) {
  return (
    <div className="p-5 bg-card border border-border/50 rounded-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
        <Icon size={48} />
      </div>
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={cn("text-xl font-black tracking-tighter", color)}>{value}</p>
    </div>
  );
}
