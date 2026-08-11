import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Download, Info, Loader2, Search as SearchIcon, Users, } from "lucide-react";
import { Mk9Panel } from "@/components/mk9/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mk9RoutesListVersioned } from "@/lib/mk9-routes.functions";
import { mk9ListPromoters } from "@/lib/mk9-data.functions";
import { cn } from "@/lib/utils";
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const WEEKDAYS_FULL = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
];
export function PromoterIndividualRoute() {
    const { promoterId } = useParams({ from: '/roteiros/promotor/$promoterId' });
    const navigate = useNavigate();
    const search = useSearch({ from: '/roteiros/promotor/$promoterId' });
    const [searchTerm, setSearchTerm] = useState("");
    const referenceDate = search.date || new Date().toISOString().slice(0, 10);
    const listRoutesFn = useServerFn(mk9RoutesListVersioned);
    const listPromotersFn = useServerFn(mk9ListPromoters);
    const routesQ = useQuery({
        queryKey: ["mk9-promoter-route", promoterId, referenceDate],
        queryFn: () => listRoutesFn({ data: { promoterId, referenceDate } }),
    });
    const promotersQ = useQuery({
        queryKey: ["mk9-promoters"],
        queryFn: () => listPromotersFn(),
    });
    const promoter = promotersQ.data?.find((p) => p.id === promoterId);
    const matrix = useMemo(() => {
        const data = routesQ.data ?? [];
        // Key: industryId|storeId
        const rows = new Map();
        for (const r of data) {
            const key = `${r.industryId}|${r.storeId}`;
            if (!rows.has(key)) {
                rows.set(key, {
                    industryName: r.industryName,
                    storeName: r.storeName,
                    storeChain: r.storeChain,
                    uf: r.storeUf,
                    days: new Set(),
                });
            }
            rows.get(key).days.add(r.weekday);
        }
        return Array.from(rows.values())
            .sort((a, b) => {
            const indComp = a.industryName.localeCompare(b.industryName, "pt-BR");
            if (indComp !== 0)
                return indComp;
            return a.storeName.localeCompare(b.storeName, "pt-BR");
        });
    }, [routesQ.data]);
    const filteredMatrix = useMemo(() => {
        if (!searchTerm.trim())
            return matrix;
        const q = searchTerm.toLowerCase();
        return matrix.filter((m) => m.industryName.toLowerCase().includes(q) ||
            m.storeName.toLowerCase().includes(q) ||
            (m.storeChain?.toLowerCase().includes(q)));
    }, [matrix, searchTerm]);
    const totalVisits = useMemo(() => {
        return matrix.reduce((acc, row) => acc + row.days.size, 0);
    }, [matrix]);
    if (routesQ.isLoading || promotersQ.isLoading) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center min-h-[400px] gap-4", children: [
                _jsx(Loader2, { className: "h-8 w-8 animate-spin text-primary" }), _jsx("p", { className: "text-sm text-muted-foreground animate-pulse font-black uppercase tracking-widest", children: "Carregando Matriz Operacional..." })
            ] }));
    }
    return (_jsxs("div", { className: "space-y-6 animate-in fade-in duration-500", children: [
            _jsx("div", { className: "flex items-center gap-2 mb-2", children: _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => navigate({ to: '/', search: { module: 'roteiros' } }), className: "text-muted-foreground hover:text-foreground -ml-2", children: [
                        _jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), _jsx("span", { className: "text-[10px] font-black uppercase tracking-widest", children: "Voltar para Gest\u00E3o" })
                    ] }) }), _jsxs("div", { className: "flex flex-col lg:flex-row lg:items-end justify-between gap-6", children: [
                    _jsx("div", { className: "space-y-1", children: _jsxs("div", { className: "flex items-center gap-3", children: [
                                _jsx("div", { className: "h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20", children: _jsx(Users, { className: "h-5 w-5 text-primary" }) }), _jsxs("div", { children: [
                                        _jsx("h1", { className: "text-2xl font-black tracking-tighter text-foreground uppercase", children: "Rota Individual" }), _jsx("p", { className: "text-sm text-muted-foreground font-medium", children: promoter?.name || "Promotor não encontrado" })
                                    ] })
                            ] }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
                            _jsxs("div", { className: "bg-card border border-border px-4 py-2 rounded-xl flex flex-col items-center justify-center min-w-[120px]", children: [
                                    _jsx("span", { className: "text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1", children: "Total de Visitas" }), _jsx("span", { className: "text-xl font-black text-primary tracking-tighter", children: totalVisits })
                                ] }), _jsxs("div", { className: "flex flex-col gap-1.5 min-w-[180px]", children: [
                                    _jsx("label", { className: "text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1", children: "Refer\u00EAncia" }), _jsxs("div", { className: "relative group", children: [
                                            _jsx(Calendar, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" }), _jsx(Input, { type: "date", value: referenceDate, onChange: (e) => navigate({ search: { ...search, date: e.target.value } }), className: "h-9 pl-9 bg-card border-border/50 text-xs font-bold uppercase tracking-tighter" })
                                        ] })
                                ] }), _jsxs(Button, { variant: "outline", disabled: true, className: "h-10 border-border text-muted-foreground text-[10px] font-black uppercase tracking-widest", children: [
                                    _jsx(Download, { className: "h-4 w-4 mr-2" }),
                                    " Exportar Excel"] })
                        ] })
                ] }), _jsxs(Mk9Panel, { className: "p-0 overflow-hidden border-border/50", children: [
                    _jsxs("div", { className: "p-4 border-b border-border/50 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4", children: [
                            _jsxs("div", { className: "relative flex-1 max-w-md", children: [
                                    _jsx(SearchIcon, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" }), _jsx(Input, { placeholder: "Buscar por loja ou ind\u00FAstria...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "h-9 pl-10 bg-background border-border/50 text-xs" })
                                ] }), _jsxs("div", { className: "flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2", children: [
                                    _jsxs("div", { className: "flex items-center gap-2", children: [
                                            _jsx("div", { className: "h-2 w-2 rounded-full bg-primary" }), _jsx("span", { children: "Visita Programada" })
                                        ] }), _jsx("span", { children: "|" }), _jsxs("span", { children: [filteredMatrix.length, " Combina\u00E7\u00F5es"] })
                                ] })
                        ] }), _jsx("div", { className: "overflow-x-auto w-full", children: _jsxs(Table, { children: [
                                _jsx(TableHeader, { className: "bg-muted/30 sticky top-0 z-10 backdrop-blur-sm", children: _jsxs(TableRow, { className: "hover:bg-transparent border-border/50", children: [
                                            _jsx(TableHead, { className: "w-[200px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground", children: "Ind\u00FAstria" }), _jsx(TableHead, { className: "min-w-[250px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground", children: "Loja" }), _jsx(TableHead, { className: "w-[60px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground text-center", children: "UF" }), WEEKDAYS.slice(1).map((d, i) => (_jsx(TableHead, { className: "w-[60px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground text-center bg-primary/5", children: d }, d))), _jsx(TableHead, { className: "w-[60px] h-10 text-[10px] font-black uppercase tracking-widest text-foreground text-center bg-primary/5", children: "DOM" })
                                        ] }) }), _jsx(TableBody, { children: filteredMatrix.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 10, className: "h-32 text-center text-muted-foreground", children: _jsxs("div", { className: "flex flex-col items-center gap-2", children: [
                                                    _jsx(Info, { className: "h-5 w-5 opacity-20" }), _jsx("span", { className: "text-xs font-medium", children: "Nenhuma rota encontrada para os filtros." })
                                                ] }) }) })) : (filteredMatrix.map((row, idx) => (_jsxs(TableRow, { className: "hover:bg-primary/5 transition-colors border-border/40 group", children: [
                                            _jsx(TableCell, { className: "font-bold text-xs uppercase tracking-tighter text-foreground py-3", children: row.industryName }), _jsx(TableCell, { className: "py-3", children: _jsxs("div", { className: "flex flex-col", children: [
                                                        _jsx("span", { className: "text-xs font-black text-foreground uppercase tracking-tight", children: row.storeName }), row.storeChain && (_jsx("span", { className: "text-[9px] font-bold text-muted-foreground uppercase tracking-widest", children: row.storeChain }))] }) }), _jsx(TableCell, { className: "text-center py-3", children: _jsx(Badge, { variant: "outline", className: "text-[9px] font-black px-1.5 h-5 bg-background border-border/50", children: row.uf || "—" }) }), [1, 2, 3, 4, 5, 6].map((day) => (_jsx(TableCell, { className: cn("text-center py-3 border-x border-border/20", row.days.has(day) ? "bg-primary/5" : ""), children: row.days.has(day) ? (_jsx("div", { className: "flex justify-center", children: _jsx("div", { className: "h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_10px_rgba(168,85,247,0.2)] animate-in zoom-in duration-300", children: _jsx("span", { className: "text-xs font-black", children: "\u2713" }) }) })) : (_jsx("span", { className: "text-[10px] text-muted-foreground/10 font-black", children: "\u2022" })) }, day))), _jsx(TableCell, { className: cn("text-center py-3 border-l border-border/20", row.days.has(0) ? "bg-primary/5" : ""), children: row.days.has(0) ? (_jsx("div", { className: "flex justify-center", children: _jsx("div", { className: "h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]", children: _jsx("span", { className: "text-xs font-black", children: "\u2713" }) }) })) : (_jsx("span", { className: "text-[10px] text-muted-foreground/10 font-black", children: "\u2022" })) })
                                        ] }, idx)))) })
                            ] }) })
                ] }), _jsxs("div", { className: "flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10", children: [
                    _jsx(Info, { className: "h-5 w-5 text-primary shrink-0" }), _jsxs("p", { className: "text-[11px] text-muted-foreground font-medium leading-relaxed", children: ["Esta matriz representa o roteiro planejado vigente na data de refer\u00EAncia. As marca\u00E7\u00F5es ",
                            _jsx("span", { className: "text-primary font-bold tracking-tight", children: "\u2713" }),
                            " indicam visitas programadas semanais. O total de ",
                            _jsxs("span", { className: "text-foreground font-black tracking-tight", children: [totalVisits, " visitas"] }),
                            " \u00E9 a soma de todas as ocorr\u00EAncias semanais."] })
                ] })
        ] }));
}
