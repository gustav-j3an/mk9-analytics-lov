/*
# Inventário de Módulos — MK9 Command Center

## 1. Módulos Descontinuados (Visão Geral)
- **Inteligência:** Consolidado no Dashboard (v2.2.0). Rota `/inteligencia` redirecionada.
- **Cockpit:** Descontinuado (v2.3.0). Rota `/cockpit` redirecionada para `/dashboard`.
  - Motivo: Sobreposição de atalhos e indicadores redundantes.
  - Funcionalidades exclusivas (Saúde do Sistema): Removidas da experiência principal por serem de uso técnico/administrativo.

## 2. Inventário do Menu Atual
- **Dashboard:** Central de monitoramento por indústria e loja. (ESSENCIAL - Home)
- **Gestão Operacional:** Configuração de vigências. (ESSENCIAL)
- **Importar Checklist:** Motor de dados. (ESSENCIAL)
- **Roteiros:** Planejamento de campo. (ESSENCIAL)
- **Presença:** Controle de ponto. (ESSENCIAL)
- **Controle de Diárias:** Gestão financeira freelancers. (ESSENCIAL)
- **Conciliação / Auditoria / Qualidade:** Hardening operacional. (ESSENCIAL)
- **Cadastros (Lojas/Indústrias/etc):** Gestão de entidades. (ESSENCIAL)

---

# MISSÃO — DESCONTINUAR O COCKPIT E SIMPLIFICAR A NAVEGAÇÃO
MK9 COMMAND CENTER

O Cockpit foi oficialmente descontinuado na v2.3.0.
O Dashboard agora é a única Home Operacional, centralizando a inteligência sem poluição visual.
*/


import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
    title: "MK9 | v2.8.0 — CHAIN NORMALIZED",
    meta: [
      {
        name: "description",
        content: "MK9 Command Center v2.8.0: CHAIN NORMALIZED. Normalização automática de redes de lojas e melhorias na exportação operacional.",

      },
      { property: "og:title", content: "MK9 | v2.8.0" },
      {
        property: "og:description",
        content: "MK9 Command Center v2.8.0: CHAIN NORMALIZED. Normalização automática de redes de lojas e melhorias na exportação operacional.",
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
    <ThemeProvider>
      <LoginContent />
    </ThemeProvider>
  );
}

function LoginContent() {
  const { theme } = useTheme();
  return (
    <div className={cn(
      "min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden font-mono selection:bg-primary/30",
      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
    )}>
      <div className="absolute top-4 right-4 z-50">
        <ThemeSettings />
      </div>

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,var(--primary)_0%,transparent_70%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>

      <div className="max-w-md w-full z-10 flex flex-col items-center">
        <div className="w-full flex flex-col justify-center space-y-6">
          <div className="bg-card/40 border border-border/50 p-8 rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <ShieldCheck className="w-16 h-16 text-primary" />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col items-center mb-8">
                <div className="p-3 bg-primary/20 rounded-xl border border-primary/30 mb-4 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]">
                  <Activity className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-black text-foreground tracking-[0.2em] uppercase text-center">
                  MK9 COMMAND CENTER
                </h1>
                <p className="text-[10px] text-muted-foreground font-bold tracking-[0.4em] uppercase mt-1">
                  OPERATIONAL GATEWAY
                </p>
              </div>

              <ClientOnly>
                <Mk9LoginForm />
              </ClientOnly>

              <div className="mt-8 pt-6 border-t border-border/50 flex flex-col items-center gap-1 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">
                  MK9 Command Center • <span className="text-primary/80">v2.8.0</span>
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                  CHAIN NORMALIZED

                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
