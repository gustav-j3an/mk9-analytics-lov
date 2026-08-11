import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

interface DashboardHeroProps {
  percentage: number;
  label: string;
  status: string;
}

export function DashboardHero({ percentage, label, status }: DashboardHeroProps) {
  return (
    <div className="glass-command p-8 rounded-3xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
        <Activity size={120} className="text-command-purple" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-muted-foreground text-sm font-bold uppercase tracking-widest">
              {label}
            </h2>
            <p className="text-white text-5xl font-black tracking-tighter">{percentage}%</p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                percentage > 85
                  ? "bg-emerald-500/10 text-emerald-500"
                  : percentage > 60
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-rose-500/10 text-rose-500",
              )}
            >
              Status: {status}
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-md w-full">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
              <span>Execução Acumulada</span>
              <span>Meta: 100%</span>
            </div>
            <div className="h-4 w-full bg-white/5 rounded-full p-1 border border-border/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-command-purple to-command-blue shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-1000"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
