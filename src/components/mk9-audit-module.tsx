import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Download, Search as SearchIcon, ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

import { mk9ListIndustries, mk9ListPromoters } from "@/lib/mk9-data.functions";
import { auditByStoreFn, auditByPromoterFn, auditByIndustryFn } from "@/lib/mk9-audit.functions";
import { Mk9ReconciliationModule } from "@/components/mk9-reconciliation-module";

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type TabKey = "industry" | "store" | "promoter" | "review";

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return d && m && y ? `${d}/${m}/${y}` : v;
}

function coverageTone(pct: number) {
  if (pct >= 100) return "text-emerald-300";
  if (pct >= 80) return "text-primary";
  if (pct >= 50) return "text-amber-300";
  return "text-rose-300";
}

function statusBadge(status: "COMPLETO" | "PARCIAL" | "NAO_REALIZADO") {
  if (status === "COMPLETO")
    return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Completo</Badge>;
  if (status === "PARCIAL")
    return <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30">Parcial</Badge>;
  return <Badge variant="outline" className="bg-rose-500/15 text-rose-300 border-rose-500/30">Não realizado</Badge>;
}

function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\ufeff" + [header.join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export interface Mk9AuditInitialFilters {
  month?: number;
  year?: number;
  industryId?: string | null;
  uf?: string | null;
  promoterId?: string | null;
}

export function Mk9AuditModule({ initialFilters }: { initialFilters?: Mk9AuditInitialFilters } = {}) {
  const now = new Date();
  const [year, setYear] = useState<number>(initialFilters?.year ?? now.getFullYear());
  const [month, setMonth] = useState<number>(initialFilters?.month ?? now.getMonth() + 1);
  const [industryId, setIndustryId] = useState<string>(initialFilters?.industryId ?? "__ALL__");
  const [promoterId, setPromoterId] = useState<string>(initialFilters?.promoterId ?? "__ALL__");
  const [uf, setUf] = useState<string>(initialFilters?.uf ?? "__ALL__");
  const [tab, setTab] = useState<TabKey>("industry");
  const [search, setSearch] = useState("");


  const industriesFn = useServerFn(mk9ListIndustries);
  const promotersFn = useServerFn(mk9ListPromoters);
  const byStoreFn = useServerFn(auditByStoreFn);
  const byPromoter = useServerFn(auditByPromoterFn);
  const byIndustry = useServerFn(auditByIndustryFn);

  const scope = useMemo(() => ({
    year, month,
    industryId: industryId === "__ALL__" ? null : industryId,
    uf: uf === "__ALL__" ? null : uf,
    promoterId: promoterId === "__ALL__" ? null : promoterId,
  }), [year, month, industryId, uf, promoterId]);

  const industriesQ = useQuery({ queryKey: ["mk9-industries"], queryFn: () => industriesFn() });
  const promotersQ = useQuery({ queryKey: ["mk9-promoters"], queryFn: () => promotersFn() });

  const enabled = tab !== "review";
  const industryQ = useQuery({
    queryKey: ["mk9-audit", "industry", scope],
    queryFn: () => byIndustry({ data: scope }),
    enabled: enabled && tab === "industry",
  });
  const storeQ = useQuery({
    queryKey: ["mk9-audit", "store", scope],
    queryFn: () => byStoreFn({ data: scope }),
    enabled: enabled && tab === "store",
  });
  const promoterQ = useQuery({
    queryKey: ["mk9-audit", "promoter", scope],
    queryFn: () => byPromoter({ data: scope }),
    enabled: enabled && tab === "promoter",
  });

  // Totais globais (usa dado da aba ativa, ou industria como fallback)
  const globalTotals = useMemo(() => {
    const rows = (industryQ.data ?? storeQ.data?.totals ?? []) as any[];
    let contratadas = 0, realizadas = 0, storesCount = 0;
    for (const r of rows) {
      contratadas += r.contratadas ?? 0;
      realizadas += r.realizadas ?? 0;
      storesCount += r.storesCount ?? 0;
    }
    const pendentes = Math.max(0, contratadas - realizadas);
    const coberturaPct = contratadas > 0 ? Math.min(100, Math.round((realizadas / contratadas) * 100)) : 0;
    return { contratadas, realizadas, pendentes, coberturaPct, storesCount };
  }, [industryQ.data, storeQ.data]);

  const filteredStores = useMemo(() => {
    const rows = (storeQ.data?.stores ?? []) as any[];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.storeName.toLowerCase().includes(q) ||
      (r.chain ?? "").toLowerCase().includes(q) ||
      (r.uf ?? "").toLowerCase().includes(q) ||
      (r.promoterName ?? "").toLowerCase().includes(q) ||
      r.industryName.toLowerCase().includes(q),
    );
  }, [storeQ.data, search]);

  const filteredPromoters = useMemo(() => {
    const rows = (promoterQ.data ?? []) as any[];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.promoterName.toLowerCase().includes(q));
  }, [promoterQ.data, search]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Auditoria de Execução
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Das visitas contratadas, quantas foram realizadas e onde estão as falhas? Contratadas vêm da frequência
            de cada indústria por loja no período configurado. Realizadas vêm do checklist importado.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <Field label="Ano">
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{[2024,2025,2026,2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Mês">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS_PT.map((m, i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Indústria" className="min-w-[200px] flex-1">
              <Select value={industryId} onValueChange={setIndustryId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Todas as indústrias</SelectItem>
                  {(industriesQ.data ?? []).map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Promotor" className="min-w-[180px] flex-1">
              <Select value={promoterId} onValueChange={setPromoterId}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Todos os promotores</SelectItem>
                  {(promotersQ.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="UF">
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger className="w-24"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Todas</SelectItem>
                  {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCell label="Lojas" value={globalTotals.storesCount} />
            <SummaryCell label="Contratadas" value={globalTotals.contratadas} tone="text-primary" />
            <SummaryCell label="Realizadas" value={globalTotals.realizadas} tone="text-emerald-300" />
            <SummaryCell label="Pendentes" value={globalTotals.pendentes} tone="text-rose-300" />
            <SummaryCell label="Cobertura" value={`${globalTotals.coberturaPct}%`} tone={coverageTone(globalTotals.coberturaPct)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="industry">Por Indústria</TabsTrigger>
              <TabsTrigger value="store">Por Loja</TabsTrigger>
              <TabsTrigger value="promoter">Por Promotor</TabsTrigger>
              <TabsTrigger value="review">Revisão manual</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab !== "review" && tab !== "industry" && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-[280px] max-w-full">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (tab === "store") {
                    downloadCsv(
                      `auditoria_lojas_${year}-${String(month).padStart(2,"0")}.csv`,
                      ["Indústria","Rede","Loja","UF","Promotor","Contratadas","Realizadas","Pendentes","Cobertura %","Status"],
                      filteredStores.map((r: any) => [
                        r.industryName, r.chain ?? "", r.storeName, r.uf ?? "", r.promoterName ?? "Não atribuído",
                        r.contratadas, r.realizadas, r.pendentes, r.coberturaPct,
                        r.status === "COMPLETO" ? "Completo" : r.status === "PARCIAL" ? "Parcial" : "Não realizado",
                      ]),
                    );
                  } else if (tab === "promoter") {
                    downloadCsv(
                      `auditoria_promotores_${year}-${String(month).padStart(2,"0")}.csv`,
                      ["Promotor","Lojas","Contratadas","Realizadas","Pendentes","Cobertura %"],
                      filteredPromoters.map((r: any) => [
                        r.promoterName, r.storesCount, r.contratadas, r.realizadas, r.pendentes, r.coberturaPct,
                      ]),
                    );
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {tab === "industry" && <IndustryTable q={industryQ} />}
          {tab === "store" && <StoreTable q={storeQ} rows={filteredStores} />}
          {tab === "promoter" && <PromoterTable q={promoterQ} rows={filteredPromoters} />}
          {tab === "review" && (
            <div className="pt-2">
              <div className="mb-4 rounded-lg border border-border bg-card/40 p-3 text-xs text-muted-foreground">
                Ferramentas avançadas de conciliação por data/planejamento. Use quando precisar auditar visitas
                individuais, aceitar divergências de data ou vincular lojas manualmente. A visão principal de execução
                está nas abas anteriores.
              </div>
              <Mk9ReconciliationModule />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  function IndustryTable({ q }: { q: ReturnType<typeof useQuery> }) {
    if (q.isLoading) return <Loading />;
    const rows = (q.data ?? []) as any[];
    if (rows.length === 0) return <Empty />;
    return (
      <div className="overflow-auto max-h-[640px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indústria</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Lojas</TableHead>
              <TableHead className="text-right">Contratadas</TableHead>
              <TableHead className="text-right">Realizadas</TableHead>
              <TableHead className="text-right">Pendentes</TableHead>
              <TableHead className="text-right">Cobertura</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.industryId}>
                <TableCell className="font-medium">{r.industryName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate(r.window.startDate)} → {fmtDate(r.window.endDate)}
                </TableCell>
                <TableCell className="text-right">{r.storesCount}</TableCell>
                <TableCell className="text-right">{r.contratadas}</TableCell>
                <TableCell className="text-right text-emerald-300">{r.realizadas}</TableCell>
                <TableCell className="text-right text-rose-300">{r.pendentes}</TableCell>
                <TableCell className={`text-right font-semibold ${coverageTone(r.coberturaPct)}`}>{r.coberturaPct}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  function StoreTable({ q, rows }: { q: ReturnType<typeof useQuery>; rows: any[] }) {
    if (q.isLoading) return <Loading />;
    if (rows.length === 0) return <Empty />;
    return (
      <div className="overflow-auto max-h-[640px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loja</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>Indústria</TableHead>
              <TableHead>Promotor</TableHead>
              <TableHead className="text-right">Contratadas</TableHead>
              <TableHead className="text-right">Realizadas</TableHead>
              <TableHead className="text-right">Pendentes</TableHead>
              <TableHead className="text-right">Cobertura</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.industryId}-${r.storeId}`}>
                <TableCell>
                  <div className="font-medium">{r.storeName}</div>
                  {r.chain && <div className="text-xs text-muted-foreground">{r.chain}</div>}
                </TableCell>
                <TableCell>{r.uf ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.industryName}</TableCell>
                <TableCell className="text-xs">{r.promoterName ?? <span className="text-muted-foreground">Não atribuído</span>}</TableCell>
                <TableCell className="text-right">{r.contratadas}</TableCell>
                <TableCell className="text-right text-emerald-300">{r.realizadas}</TableCell>
                <TableCell className="text-right text-rose-300">{r.pendentes}</TableCell>
                <TableCell className={`text-right font-semibold ${coverageTone(r.coberturaPct)}`}>{r.coberturaPct}%</TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  function PromoterTable({ q, rows }: { q: ReturnType<typeof useQuery>; rows: any[] }) {
    if (q.isLoading) return <Loading />;
    if (rows.length === 0) return <Empty />;
    return (
      <div className="overflow-auto max-h-[640px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Promotor</TableHead>
              <TableHead className="text-right">Lojas</TableHead>
              <TableHead className="text-right">Contratadas</TableHead>
              <TableHead className="text-right">Realizadas</TableHead>
              <TableHead className="text-right">Pendentes</TableHead>
              <TableHead className="text-right">Cobertura</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.promoterId ?? "none"}>
                <TableCell className="font-medium">{r.promoterName}</TableCell>
                <TableCell className="text-right">{r.storesCount}</TableCell>
                <TableCell className="text-right">{r.contratadas}</TableCell>
                <TableCell className="text-right text-emerald-300">{r.realizadas}</TableCell>
                <TableCell className="text-right text-rose-300">{r.pendentes}</TableCell>
                <TableCell className={`text-right font-semibold ${coverageTone(r.coberturaPct)}`}>{r.coberturaPct}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
}

function Loading() {
  return (
    <div className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
    </div>
  );
}
function Empty() {
  return (
    <div className="text-sm text-muted-foreground py-10 text-center">
      Sem dados no período. Verifique se a frequência da indústria e o checklist foram importados.
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
