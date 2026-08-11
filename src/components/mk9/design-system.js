import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, Inbox } from "lucide-react";
export const Mk9Panel = React.forwardRef(({ className, glass = true, ...props }, ref) => {
    return (_jsx("div", { ref: ref, className: cn(glass ? "glass-command" : "bg-command-card border border-border/50", "p-6 rounded-2xl shadow-2xl", className), ...props }));
});
Mk9Panel.displayName = "Mk9Panel";
export function Mk9PageHeader({ title, subtitle, icon: Icon, actions }) {
    return (_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8", children: [
            _jsxs("div", { className: "flex items-center gap-4", children: [Icon && (_jsx("div", { className: "h-12 w-12 rounded-xl bg-command-purple/10 flex items-center justify-center neon-border-purple", children: _jsx(Icon, { className: "h-6 w-6 text-command-purple" }) })), _jsxs("div", { children: [
                            _jsx("h1", { className: "text-xl md:text-2xl font-black text-foreground tracking-tighter uppercase", children: title }), subtitle && (_jsx("p", { className: "text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1", children: subtitle }))] })
                ] }), actions && _jsx("div", { className: "flex items-center gap-3", children: actions })] }));
}
export function Mk9MetricCard({ label, value, hint, icon: Icon, color = "purple", onClick, className, }) {
    const colorMap = {
        purple: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-purple-500/5",
        blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-blue-500/5",
        emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5",
        amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-amber-500/5",
        rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-rose-500/5",
        sky: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20 shadow-sky-500/5",
        orange: "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20 shadow-orange-500/5",
    };
    return (_jsx("div", { onClick: onClick, className: cn("glass-command p-5 rounded-2xl group transition-all duration-300", onClick && "cursor-pointer hover:border-white/20 active:scale-[0.98]", className), children: _jsxs("div", { className: "flex items-start justify-between", children: [
                _jsxs("div", { children: [
                        _jsx("p", { className: "text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1", children: label }), _jsx("h3", { className: "text-xl md:text-2xl font-black text-foreground tracking-tighter", children: value }), hint && (_jsx("p", { className: "text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-wider", children: hint }))] }), Icon && (_jsx("div", { className: cn("p-2.5 rounded-xl border transition-colors", colorMap[color]), children: _jsx(Icon, { className: "h-5 w-5" }) }))] }) }));
}
export function Mk9Badge({ children, className, variant = "default", }) {
    const variants = {
        default: "border-border bg-muted/50 text-foreground/80",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        danger: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
        info: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    };
    return (_jsx("span", { className: cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border", variants[variant], className), children: children }));
}
export function Mk9LoadingState({ message = "Carregando dados..." }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 gap-4", children: [
            _jsx(Loader2, { className: "h-10 w-10 animate-spin text-command-purple/20" }), _jsx("p", { className: "text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]", children: message })
        ] }));
}
export function Mk9EmptyState({ message = "Nenhum registro encontrado.", action, }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-border rounded-2xl bg-muted/20 text-center px-6", children: [
            _jsx(Inbox, { className: "h-10 w-10 text-muted-foreground/60" }), _jsx("p", { className: "text-sm font-semibold text-foreground/80", children: message }), action && _jsx("div", { className: "mt-2", children: action })] }));
}
export function Mk9ErrorState({ message = "Erro ao carregar dados.", onRetry, }) {
    return (_jsxs("div", { className: "p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-400 flex flex-col items-center gap-4 text-center", children: [
            _jsx(AlertTriangle, { className: "h-10 w-10 opacity-50" }), _jsxs("div", { children: [
                    _jsx("p", { className: "text-sm font-black uppercase tracking-tight", children: "Falha na Opera\u00E7\u00E3o" }), _jsx("p", { className: "text-xs opacity-70 mt-1", children: message })
                ] }), onRetry && (_jsx("button", { onClick: onRetry, className: "px-6 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors", children: "Tentar Novamente" }))] }));
}
