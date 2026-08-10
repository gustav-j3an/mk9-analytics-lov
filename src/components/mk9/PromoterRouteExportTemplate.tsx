import React from "react";

const WEEKDAY_PT = [
  "DOMINGO",
  "SEGUNDA-FEIRA",
  "TERÇA-FEIRA",
  "QUARTA-FEIRA",
  "QUINTA-FEIRA",
  "SEXTA-FEIRA",
  "SÁBADO",
];

interface ExportData {
  promoterName: string;
  referenceDate: string;
  stats: {
    days: number;
    stops: number;
    items: number;
  };
  groupedByDay: Array<{
    weekday: number;
    stops: Array<{
      storeName: string;
      storeChain: string | null;
      uf: string | null;
      industries: string[];
    }>;
  }>;
}

export const PromoterRouteExportTemplate = React.forwardRef<HTMLDivElement, { data: ExportData }>(
  ({ data }, ref) => {
    return (
      <div
        ref={ref}
        id="mk9-pdf-template"
        className="bg-white p-[15mm] text-slate-900 font-sans"
        style={{ width: "210mm", minHeight: "297mm", position: "absolute", left: "-9999px", top: "0" }}
      >
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-black tracking-tighter text-slate-900">MK9 TRADE</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] -mt-1">
              Roteiro Semanal
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-black uppercase text-slate-900">
              {data.promoterName || "PROMOTOR"}
            </h1>
            <p className="text-xs font-bold text-slate-500">
              Referência: {new Date(data.referenceDate).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded px-4 py-2 mb-8 flex items-center justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <span>{data.stats.days} DIAS</span>
          <span className="text-slate-300">•</span>
          <span>{data.stats.stops} PARADAS</span>
          <span className="text-slate-300">•</span>
          <span>{data.stats.items} ITENS</span>
        </div>

        <div className="space-y-8">
          {data.groupedByDay.map(({ weekday, stops }) => (
            <div key={weekday} className="break-inside-avoid">
              <div className="flex items-end justify-between border-b border-slate-900 pb-1 mb-4">
                <h3 className="text-sm font-black tracking-[0.1em] text-slate-900">
                  {WEEKDAY_PT[weekday]}
                </h3>
                <span className="text-[10px] font-bold text-slate-500">
                  {stops.length} {stops.length === 1 ? "PARADA" : "PARADAS"}
                </span>
              </div>

              <div className="space-y-4">
                {stops.map((stop, idx) => (
                  <div key={idx} className="flex gap-4 break-inside-avoid">
                    <div className="text-sm font-black text-slate-300 tabular-nums">
                      {(idx + 1).toString().padStart(2, "0")}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          {stop.storeChain ? `${stop.storeChain} - ` : ""}
                          {stop.storeName}
                        </h4>
                        {stop.uf && (
                          <span className="text-[10px] font-black text-slate-400">{stop.uf}</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-600 italic">
                        {stop.industries.join(" • ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-4 border-t border-slate-100 text-[8px] text-slate-400 text-center uppercase tracking-widest">
          MK9 Analytics • Roteiro Gerado em {new Date().toLocaleString("pt-BR")}
        </div>
      </div>
    );
  }
);

PromoterRouteExportTemplate.displayName = "PromoterRouteExportTemplate";
