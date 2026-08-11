import { useMemo } from "react";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { mk9ListRoutesDetailed } from "@/lib/mk9-data.functions";
import { 
  ClipboardCheck, 
  MapPin, 
  Calendar, 
  LogOut, 
  User,
  LayoutDashboard,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ThemeSettings } from "@/lib/mk9-theme/ThemeToggle";

export function Mk9PortalDashboard() {
  const { user, profile, signOut } = useMk9Session();
  const listRoutesFn = useServerFn(mk9ListRoutesDetailed);
  
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: routes, isLoading } = useQuery({
    queryKey: ["mk9-portal-routes", month, year],
    queryFn: () => listRoutesFn({ data: { month, year } })
  });

  const today = now.getDay(); // 0-6 (Sun-Sat)
  // Ajuste se o banco usar 1-7 ou 0-6
  const todayRoutes = useMemo(() => {
    return (routes ?? []).filter(r => r.weekday === today);
  }, [routes, today]);

  const stats = useMemo(() => {
    return {
      total: routes?.length ?? 0,
      today: todayRoutes.length,
      // Mocked for now until we have actual_visits integration in the portal
      completed: 0 
    };
  }, [routes, todayRoutes]);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/30">
      {/* Header Mobile-First */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-lg glow-primary">
            <ClipboardCheck className="text-foreground h-5 w-5" />
          </div>
          <span className="font-black tracking-tighter text-lg uppercase">
            MK9 <span className="text-primary">PORTAL</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSettings />
          <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-rose-500">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 max-w-md mx-auto w-full">
        {/* Saudação */}
        <section className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-foreground uppercase">
            Olá, {profile?.name?.split(' ')[0] || 'Promotor'}
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
          </p>
        </section>

        {/* KPIs Rápidos */}
        <section className="grid grid-cols-2 gap-3">
          <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-primary">{stats.today}</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">
                Lojas Hoje
              </span>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-primary">{stats.total}</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">
                Total Mês
              </span>
            </CardContent>
          </Card>
        </section>

        {/* Roteiro do Dia */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Roteiro de Hoje
            </h2>
            <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
              {todayRoutes.length} LOJAS
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Clock className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : todayRoutes.length > 0 ? (
            <div className="space-y-3">
              {todayRoutes.map((route) => (
                <Card key={route.id} className="bg-card/40 border-border/50 hover:border-primary/50 transition-colors overflow-hidden group">
                  <CardContent className="p-0">
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <h3 className="font-black text-sm uppercase leading-none text-foreground group-hover:text-primary transition-colors">
                            {route.storeName}
                          </h3>
                          <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-tighter">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {route.storeChain || 'Independente'} • {route.storeUf}
                          </p>
                        </div>
                        <Badge className="bg-primary/20 text-primary border-primary/30 shrink-0 text-[9px] font-black uppercase tracking-tighter">
                          {route.industryName}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <Button className="flex-1 h-9 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">
                          Abrir Checklist
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-border/50">
                          <MapPin className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-card/20 border border-dashed border-border/50 rounded-xl p-8 text-center flex flex-col items-center gap-3">
              <Calendar className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Nenhuma loja programada para hoje
              </p>
            </div>
          )}
        </section>

        {/* Roteiro Completo do Mês (Opcional ou link) */}
        <section className="pt-4 border-t border-border/30">
           <Button variant="ghost" className="w-full text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-primary">
             Ver roteiro completo do mês
           </Button>
        </section>
      </main>

      {/* Footer / Navbar Mobile */}
      <nav className="sticky bottom-0 w-full bg-background/80 backdrop-blur-md border-t border-border px-6 h-16 flex items-center justify-around md:hidden">
        <button className="flex flex-col items-center gap-1 text-primary">
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Início</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground opacity-50">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Checkins</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground opacity-50">
          <User className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Perfil</span>
        </button>
      </nav>
    </div>
  );
}
