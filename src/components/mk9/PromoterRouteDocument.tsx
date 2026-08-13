import { cn } from "../../lib/utils";

interface MatrixRow {
  industryName: string;
  storeName: string;
  storeChain: string | null;
  uf: string | null;
  days: Record<number, string>;
}

interface PromoterRouteDocumentProps {
  promoterName: string;
  referenceDate: string;
  totalVisits: number;
  rows: MatrixRow[];
  minimal?: boolean;
}

const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];

export function PromoterRouteDocument({
  promoterName,
  referenceDate,
  totalVisits,
  rows,
  minimal = false
}: PromoterRouteDocumentProps) {
  if (minimal) {
    return (
      <div className="bg-white text-slate-950">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              MK9 COMMAND CENTER
            </h1>
            <h2 className="text-base font-bold text-slate-500 uppercase tracking-widest">
              Rota Individual
            </h2>
          </div>
          
          <div className="text-right space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Emissão</p>
            <p className="text-sm font-bold text-slate-900">
              {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Promotor</span>
            <span className="text-base font-black text-slate-900 uppercase leading-none">
              {promoterName}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Referência</span>
            <span className="text-base font-black text-slate-900 leading-none">
              {referenceDate.split('-').reverse().join('/')}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total de Visitas</span>
            <span className="text-xl font-black text-primary leading-none">
              {totalVisits}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-slate-950 p-8 min-h-screen font-sans selection:bg-primary/20">
      {/* Container A4 Landscape reference (approx) */}
      <div className="max-w-[297mm] mx-auto bg-white">
        
        {/* Header Section */}
        <div className="flex justify-between items-start border-b-2 border-slate-900/10 pb-6 mb-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              MK9 COMMAND CENTER
            </h1>
            <h2 className="text-lg font-bold text-slate-500 uppercase tracking-widest">
              Rota Individual
            </h2>
          </div>
          
          <div className="text-right space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Emissão</p>
            <p className="text-sm font-bold text-slate-900">
              {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-3 gap-12 mb-10 bg-slate-50 p-6 rounded-xl border border-slate-200/60">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Promotor</span>
            <span className="text-lg font-black text-slate-900 uppercase leading-none">
              {promoterName}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Referência</span>
            <span className="text-lg font-black text-slate-900 leading-none">
              {referenceDate.split('-').reverse().join('/')}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total de Visitas</span>
            <span className="text-2xl font-black text-primary leading-none">
              {totalVisits}
            </span>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-r border-slate-200 w-[20%]">Indústria</th>
                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-r border-slate-200 w-[35%]">Loja</th>
                <th className="px-2 py-3 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest border-r border-slate-200 w-[5%]">UF</th>
                {WEEKDAYS.map((day) => (
                  <th key={day} className="px-2 py-3 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest border-r border-slate-200 w-[5.7%]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={cn("border-b border-slate-200", idx % 2 === 1 ? "bg-slate-50/50" : "bg-white")}>
                  <td className="px-4 py-3 text-xs font-bold text-slate-900 uppercase border-r border-slate-200">
                    {row.industryName}
                  </td>
                  <td className="px-4 py-3 border-r border-slate-200">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900 uppercase">{row.storeName}</span>
                      {row.storeChain && (
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{row.storeChain}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-[10px] font-black text-slate-600 border-r border-slate-200">
                    {row.uf || "—"}
                  </td>
                  {/* SEG (1) to SAB (6) then DOM (0) */}
                  {[1, 2, 3, 4, 5, 6, 0].map((dayCode) => (
                    <td 
                      key={dayCode} 
                      className={cn(
                        "px-2 py-3 text-center border-r border-slate-200 last:border-r-0",
                        row.days[dayCode] ? "bg-primary/5" : ""
                      )}
                    >
                      {row.days[dayCode] ? (
                        <div className="flex justify-center">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <span className="text-xs font-black">✓</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-200">•</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
          MK9 Analytics • Documento Gerado pelo Sistema • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
