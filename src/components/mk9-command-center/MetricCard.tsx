import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  trend?: "up" | "down";
  trendValue?: string;
  color?: "purple" | "blue" | "cyan" | "rose" | "emerald" | "amber";
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  trendValue,
  color = "blue",
  onClick,
}: MetricCardProps) {
  const colorMap = {
    purple: "text-command-purple bg-command-purple/10",
    blue: "text-command-blue bg-command-blue/10",
    cyan: "text-command-cyan bg-command-cyan/10",
    rose: "text-rose-500 bg-rose-500/10",
    emerald: "text-emerald-500 bg-emerald-500/10",
    amber: "text-amber-500 bg-amber-500/10",
  };

  const glowMap = {
    purple: "glow-purple",
    blue: "glow-blue",
    cyan: "glow-cyan",
    rose: "shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    emerald: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    amber: "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "glass-command p-5 rounded-2xl group transition-all duration-300 hover:scale-[1.02] cursor-pointer relative overflow-hidden",
        glowMap[color]
      )}
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={80} />
      </div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={cn("p-2.5 rounded-xl", colorMap[color])}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            trend === "up" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
          )}>
            {trend === "up" ? "↑" : "↓"} {trendValue}
          </span>
        )}
      </div>

      <div className="space-y-1 relative z-10">
        <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{label}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        </div>
        {hint && <p className="text-[10px] text-muted-foreground/80 font-medium truncate">{hint}</p>}
      </div>
      
      <div className={cn(
        "absolute bottom-0 left-0 w-full h-0.5 opacity-30",
        color === "purple" && "bg-gradient-to-r from-transparent via-purple-500 to-transparent",
        color === "blue" && "bg-gradient-to-r from-transparent via-blue-500 to-transparent",
        color === "cyan" && "bg-gradient-to-r from-transparent via-cyan-500 to-transparent",
        color === "rose" && "bg-gradient-to-r from-transparent via-rose-500 to-transparent",
        color === "emerald" && "bg-gradient-to-r from-transparent via-emerald-500 to-transparent",
        color === "amber" && "bg-gradient-to-r from-transparent via-amber-500 to-transparent",
      )} />
    </div>
  );
}
