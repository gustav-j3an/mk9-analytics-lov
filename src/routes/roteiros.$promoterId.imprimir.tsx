import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mk9RoutesListVersioned } from "@/lib/mk9-routes.functions";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";

const WEEKDAY_PT = [
  "DOMINGO",
  "SEGUNDA-FEIRA",
  "TERÇA-FEIRA",
  "QUARTA-FEIRA",
  "QUINTA-FEIRA",
  "SEXTA-FEIRA",
  "SÁBADO",
];

export const Route = createFileRoute("/roteiros/\$promoterId/imprimir")({
  validateSearch: (search) => z.object({
    date: z.string().optional(),
  }).parse(search),
  component: PromoterPrintView,
});

function PromoterPrintView() {
  const { promoterId } = Route.useParams();
  const { date } = Route.useSearch();
  const referenceDate = date || new Date().toISOString().slice(0, 10);

  const listFn = useServerFn(mk9RoutesListVersioned);
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["mk9-routes-print", referenceDate, promoterId],
    queryFn: () => listFn({ data: { referenceDate, promoterId } }),
  });

  const promoterName = routes.length > 0 ? routes[0].promoterName : "";

  const stats = useMemo(() => {
    const days = new Set(routes.map(r => r.weekday));
    const stops = new Set(routes.map(r => \`\${r.weekday}-\${r.storeId}\`));
    return {
      days: days.size,
      stops: stops.size,
      items: routes.length
    };
  }, [routes]);

  const groupedByDay = useMemo(() => {
    const m = new Map<number, Map<string, { storeName: string; storeChain: string | null; uf: string | null; industries: string[] }>>();
    
    const sorted = [...routes].sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.storeName.localeCompare(b.storeName);
    });

    for (const r of sorted) {
      if (!m.has(r.weekday)) m.set(r.weekday, new Map());
      const dayMap = m.get(r.weekday)!;
      const storeKey = r.storeId || r.storeName;
      
      if (!dayMap.has(storeKey)) {
        dayMap.set(storeKey, {
          storeName: r.storeName,
          storeChain: r.storeChain,
          uf: r.storeUf,
          industries: []
        });
      }
      dayMap.get(storeKey)!.industries.push(r.industryName);
    }
    
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [routes]);

  useEffect(() => {
    if (promoterName) {
      document.title = \`ROTEIRO - \${promoterName.toUpperCase()}\`;
    }
  }, [promoterName]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white pb-20 print:pb-0">
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3 print:hidden flex items-center justify-between shadow-sm">
        <Button 
          variant="ghost" 
          onClick={() => window.history.back()}
          className="text-slate-600"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Visualização de Impressão
          </span>
          <Button 
            onClick={() => window.print()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Printer className="h-4 w-4 mr-2" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      <div className="max-w-[210mm] mx-auto my-8 print:my-0 bg-white shadow-xl print:shadow-none min-h-[297mm] p-[15mm] text-slate-900 font-sans selection:bg-purple-100">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-black tracking-tighter text-slate-900">MK9 TRADE</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] -mt-1">Roteiro Semanal</p>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-black uppercase text-slate-900">{promoterName || "PROMOTOR"}</h1>
            <p className="text-xs font-bold text-slate-500">Referência: {new Date(referenceDate).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded px-4 py-2 mb-8 flex items-center justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <span>{stats.days} DIAS</span>
          <span className="text-slate-300">•</span>
          <span>{stats.stops} PARADAS</span>
          <span className="text-slate-300">•</span>
          <span>{stats.items} ITENS</span>
        </div>

        <div className="space-y-8">
          {groupedByDay.map(([weekday, stopsMap]) => {
            const stops = Array.from(stopsMap.values());
            return (
              <div key={weekday} className="break-inside-avoid">
                <div className="flex items-end justify-between border-b border-slate-900 pb-1 mb-4">
                  <h3 className="text-sm font-black tracking-[0.1em] text-slate-900">
                    {WEEKDAY_PT[weekday]}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500">
                    {stops.length} {stops.length === 1 ? 'PARADA' : 'PARADAS'}
                  </span>
                </div>

                <div className="space-y-4">
                  {stops.map((stop, idx) => (
                    <div key={idx} className="flex gap-4 break-inside-avoid">
                      <div className="text-sm font-black text-slate-300 tabular-nums">
                        {(idx + 1).toString().padStart(2, '0')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">
                            {stop.storeChain ? \`\${stop.storeChain} - \` : ''}{stop.storeName}
                          </h4>
                          {stop.uf && (
                            <span className="text-[10px] font-black text-slate-400">{stop.uf}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-slate-600 italic">
                          {stop.industries.join(' • ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 pt-4 border-t border-slate-100 text-[8px] text-slate-400 text-center uppercase tracking-widest">
          MK9 Analytics • Roteiro Gerado em {new Date().toLocaleString('pt-BR')}
        </div>
      </div>

      <style>{\`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact;
          }
          .print\\\\:hidden {
            display: none !important;
          }
        }
      \`}</style>
    </div>
  );
}
