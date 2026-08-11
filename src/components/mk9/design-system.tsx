import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, Loader2, AlertTriangle, Inbox } from "lucide-react";

interface Mk9PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export const Mk9Panel = React.forwardRef<HTMLDivElement, Mk9PanelProps>(
  ({ className, glass = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          glass ? "glass-command" : "bg-command-card border border-white/5",
          "p-6 rounded-2xl shadow-2xl",
          className,
        )}
        {...props}
      />
    );
  },
);
Mk9Panel.displayName = "Mk9Panel";

interface Mk9PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export function Mk9PageHeader({ title, subtitle, icon: Icon, actions }: Mk9PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="h-12 w-12 rounded-xl bg-command-purple/10 flex items-center justify-center neon-border-purple">
            <Icon className="h-6 w-6 text-command-purple" />
          </div>
        )}
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase">{title}</h1>
          {subtitle && (
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export interface Mk9MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  color?: "purple" | "blue" | "emerald" | "amber" | "rose" | "sky" | "orange";
  onClick?: () => void;
  className?: string;
}

export function Mk9MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  color = "purple",
  onClick,
  className,
}: Mk9MetricCardProps) {
  const colorMap = {
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-purple-500/5",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-blue-500/5",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-amber-500/5",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-rose-500/5",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/20 shadow-sky-500/5",
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/20 shadow-orange-500/5",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "glass-command p-5 rounded-2xl group transition-all duration-300",
        onClick && "cursor-pointer hover:border-white/20 active:scale-[0.98]",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">
            {label}
          </p>
          <h3 className="text-xl md:text-2xl font-black text-white tracking-tighter">{value}</h3>
          {hint && (
            <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">
              {hint}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2.5 rounded-xl border transition-colors", colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function Mk9Badge({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const variants = {
    default: "border-border bg-white/5 text-slate-300",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    danger: "border-rose-500/20 bg-rose-500/10 text-rose-400",
    info: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  };

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Mk9LoadingState({ message = "Carregando dados..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-command-purple/20" />
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{message}</p>
    </div>
  );
}

export function Mk9EmptyState({
  message = "Nenhum registro encontrado.",
  action,
}: {
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
      <Inbox className="h-10 w-10 text-slate-700" />
      <p className="text-sm font-medium text-muted-foreground italic">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Mk9ErrorState({
  message = "Erro ao carregar dados.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-400 flex flex-col items-center gap-4 text-center">
      <AlertTriangle className="h-10 w-10 opacity-50" />
      <div>
        <p className="text-sm font-black uppercase tracking-tight">Falha na Operação</p>
        <p className="text-xs opacity-70 mt-1">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
        >
          Tentar Novamente
        </button>
      )}
    </div>
  );
}
