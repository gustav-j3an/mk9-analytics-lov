import { cn } from "@/lib/utils";

interface PerformanceCardProps {
  label: string;
  percentage: number;
  status: "Excelente" | "Atenção" | "Crítico";
  comparison: string;
}

export function PerformanceCard({ label, percentage, status, comparison }: PerformanceCardProps) {
  const statusColor = {
    Excelente: "text-emerald-500",
    Atenção: "text-amber-500",
    Crítico: "text-rose-500",
  };

  return (
    <div className="glass-command p-6 rounded-2xl relative overflow-hidden glow-purple">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          {label}
        </h3>
        <span
          className={cn("text-xs font-bold px-2 py-1 rounded-full bg-muted/50", statusColor[status])}
        >
          {status}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-foreground/5"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={251.2}
              strokeDashoffset={251.2 - (251.2 * percentage) / 100}
              className={statusColor[status]}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-foreground">
            {percentage}%
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <p className="text-foreground text-3xl font-bold tracking-tight">{percentage}%</p>
          <p className="text-muted-foreground text-xs">{comparison}</p>
        </div>
      </div>
    </div>
  );
}
