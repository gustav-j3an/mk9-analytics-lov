import { cn } from "@/lib/utils";

interface IndustryItem {
  name: string;
  percentage: number;
  visits: number;
  status: "Excelente" | "Atenção" | "Crítico";
}

interface IndustryCardProps {
  industries: IndustryItem[];
}

export function IndustryCard({ industries }: IndustryCardProps) {
  const statusColor = {
    Excelente: "bg-emerald-500",
    Atenção: "bg-amber-500",
    Crítico: "bg-rose-500",
  };

  return (
    <div className="glass-command p-6 rounded-2xl shadow-xl">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">
        Performance por Indústria
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {industries.map((industry) => (
          <div
            key={industry.name}
            className="bg-command-card-alt/50 border border-border/50 p-4 rounded-xl hover:bg-command-card-alt transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-white text-sm font-bold">{industry.name}</span>
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted/50",
                  industry.percentage > 85
                    ? "text-emerald-500"
                    : industry.percentage > 60
                      ? "text-amber-500"
                      : "text-rose-500",
                )}
              >
                {industry.percentage}%
              </span>
            </div>
            <div className="space-y-2">
              <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    industry.percentage > 85
                      ? "bg-emerald-500"
                      : industry.percentage > 60
                        ? "bg-amber-500"
                        : "bg-rose-500",
                  )}
                  style={{ width: `${industry.percentage}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {industry.visits} visitas realizadas
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
