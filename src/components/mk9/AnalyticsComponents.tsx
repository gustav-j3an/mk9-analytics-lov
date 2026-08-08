import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatPercentage } from "@/lib/mk9/normalization";


interface AnalyticsMetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  color?: "purple" | "blue" | "emerald" | "amber" | "rose" | "cyan";
  comparison?: {
    value: number | string;
    label: string;
    trend: "up" | "down" | "neutral";
    percentChange?: number;
  };

  onClick?: () => void;
  className?: string;
}

export function AnalyticsMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  color = "purple",
  comparison,
  onClick,
  className,
}: AnalyticsMetricCardProps) {
  const colorMap = {
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "glass-command p-5 rounded-2xl group transition-all duration-300 relative overflow-hidden",
        onClick && "cursor-pointer hover:border-white/20 active:scale-[0.98]",
        className,
      )}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-0.5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tighter italic">{value}</h3>
          </div>
          {hint && (
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              {hint}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2 rounded-xl border", colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {comparison && (
        <div className="mt-4 flex items-center gap-2 relative z-10">
          <div
            className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black",
              comparison.trend === "up"
                ? "text-emerald-400 bg-emerald-500/10"
                : comparison.trend === "down"
                  ? "text-rose-400 bg-rose-500/10"
                  : "text-slate-400 bg-white/5",
            )}
          >
            {comparison.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
            {comparison.trend === "down" && <ArrowDownRight className="h-3 w-3" />}
            {comparison.trend === "neutral" && <Minus className="h-3 w-3" />}
            {typeof comparison.value === "number"
              ? formatPercentage(comparison.value).replace("%", "")
              : comparison.value}
            {typeof comparison.value === "number" && "%"}
            {comparison.percentChange !== undefined && (
              <span className="ml-1 opacity-70">
                ({comparison.percentChange > 0 ? "+" : ""}
                {formatPercentage(comparison.percentChange)})
              </span>
            )}

          </div>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
            {comparison.label}
          </span>
        </div>
      )}

      <div
        className={cn(
          "absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 opacity-5 blur-3xl rounded-full",
          color === "purple" && "bg-purple-500",
          color === "blue" && "bg-blue-500",
          color === "emerald" && "bg-emerald-500",
          color === "amber" && "bg-amber-500",
          color === "rose" && "bg-rose-500",
          color === "cyan" && "bg-cyan-500",
        )}
      />
    </div>
  );
}

export function AnalyticsChartCard({
  title,
  subtitle,
  children,
  className,
  height = 300,
}: {
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div className={cn("glass-command p-6 rounded-2xl flex flex-col h-full", className)}>
      <div className="mb-6">
        <div className="text-sm font-black text-white uppercase tracking-[0.1em]">{title}</div>

        {subtitle && (
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ height }} className="w-full mt-auto">
        {children}
      </div>
    </div>
  );
}

export function AnalyticsTable({
  headers,
  rows,
  className,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto custom-scrollbar-horizontal", className)}>
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest",
                  i > 0 && "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="group">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-3 text-xs bg-white/[0.02] border-y border-white/5 transition-colors group-hover:bg-white/[0.04]",
                    j === 0 && "rounded-l-xl border-l text-left",
                    j > 0 && "text-right",
                    j === row.length - 1 && "rounded-r-xl border-r",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
