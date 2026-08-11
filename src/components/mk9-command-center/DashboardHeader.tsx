import { cn } from "@/lib/utils";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { Badge } from "@/components/ui/badge";

export function DashboardHeader({ month, year }: { month: number; year: number }) {
  const { user, roles } = useMk9Session();
  const isAdmin = roles.includes("ADMIN");
  const isSupervisor = roles.includes("SUPERVISOR");
  const isAuditor = roles.includes("AUDITOR");

  const MONTHS_PT = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tighter flex items-center gap-2">
          MK9 <span className="text-command-purple">COMMAND CENTER</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            COMPETÊNCIA:{" "}
            <span className="text-foreground">
              {MONTHS_PT[month - 1]} / {year}
            </span>
          </span>
          <div className="h-3 w-[1px] bg-white/10" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
            STATUS: OPERAÇÃO ONLINE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-foreground">{user?.email?.split("@")[0]}</p>
          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">
            {isAdmin
              ? "Administrator"
              : isSupervisor
                ? "Supervisor"
                : isAuditor
                  ? "Auditor"
                  : "Operator"}
          </p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-command-purple to-command-blue p-[1px]">
          <div className="h-full w-full rounded-[11px] bg-background flex items-center justify-center text-foreground font-black text-sm">
            {user?.email?.[0].toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}
