// v3.6.0 — INDUSTRY NAME EDIT FIXED
/*
# MISSÃO — CORRIGIR EDIÇÃO DO NOME DA INDÚSTRIA

## STATUS: CONCLUÍDO (v3.6.0)
- Motor de atualização restaurado com suporte a `name` e `name_normalized`.
- Sincronização automática com `mk9_industry_period_config`.
- Tratamento de conflito de duplicidade (UNIQUE) implementado.
- Reatividade garantida via invalidação de cache.
*/

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mk9LoginForm } from "@/components/mk9-login-form";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { Loader2, Activity, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/client-only";
import { ThemeProvider, useTheme } from "@/lib/mk9-theme/ThemeContext";
import { ThemeSettings } from "@/lib/mk9-theme/ThemeToggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    title: "MK9 | v3.6.0 — INDUSTRY EDIT FIXED",
    meta: [
      {
        name: "description",
        content: "MK9 Command Center v3.6.0: Industry name editing fixed with normalization and uniqueness constraints.",
      },
      { property: "og:title", content: "MK9 | v3.6.0 — INDUSTRY EDIT FIXED" },
      {
        property: "og:description",
        content: "MK9 Command Center v3.6.0: Industry name editing fixed with normalization and uniqueness constraints.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function LandingPage() {
  const { session, loading, roles, signOut } = useMk9Session();
  const search = Route.useSearch() as { session_expired?: string };
  const navigate = useNavigate();

  useEffect(() => {
    if (search.session_expired === "true") {
      signOut();
      toast.info("Sua sessão expirou. Faça login novamente.");
      navigate({ to: "/", replace: true });
      return;
    }

    if (!loading && session) {
      if (roles.includes("PROMOTOR") && !roles.includes("ADMIN") && !roles.includes("SUPERVISOR")) {
        navigate({ to: "/mk9-portal", replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [session, loading, navigate, search.session_expired, signOut]);

  if (loading || session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <header className="relative z-10 flex h-20 w-full items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-foreground">
              MK9 <span className="text-primary">Analytics</span>
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
              v3.6.0 — Industry Edit Fixed
            </p>
          </div>
        </div>
        <div className="hidden md:block">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Sistema Seguro & Auditado
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center p-6 md:p-12">
        <div className="grid w-full max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-8 animate-in fade-in slide-in-from-left duration-1000">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Controle Operacional Avançado
              </span>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-4xl font-black uppercase leading-none tracking-tighter md:text-6xl lg:text-7xl">
                O Futuro da <br />
                <span className="text-primary italic">Auditoria</span> de <br />
                Ponto de Venda.
              </h2>
              <p className="max-w-md text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
                Plataforma de inteligência para gestão de roteiros, 
                checklist de presença e conciliação de visitas em tempo real.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4 sm:grid-cols-3">
              {[
                { label: "Checklists", value: "Real-time" },
                { label: "Roteiros", value: "Smart" },
                { label: "BI", value: "Drill-down" },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="text-lg font-bold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end animate-in fade-in slide-in-from-right duration-1000">
            <ClientOnly>
              <Mk9LoginForm />
            </ClientOnly>
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex h-20 w-full items-center justify-center border-t border-border/50 bg-background/50 px-6 backdrop-blur-md">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
          © 2026 MK9 Analytics • Todos os direitos reservados • v3.6.0
        </p>
      </footer>
    </div>
  );
}
