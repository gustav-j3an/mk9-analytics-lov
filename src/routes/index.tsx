/*
# Inventário de Módulos — MK9 Command Center

## 1. Módulo Inteligência (Auditado)
- **Status:** Consolidado e Removido da Navegação.
- **Rota:** `/inteligencia` (Redirecionada para `/dashboard`).
- **Análise:**
  - A — JÁ EXISTE NO DASHBOARD: Indicadores de cobertura, totalizadores de previstas/realizadas por indústria.
  - B — DEVE SER INCORPORADA AO DASHBOARD: Drill-down por loja (Incorporado na v2.1.0).
  - D — NÃO TEM MAIS UTILIDADE: Gráficos de barra redundantes que não permitiam ação imediata.
- **Impacto:** Redução de complexidade e carregamento de queries agregadas pesadas no início da sessão.

## 2. Inventário dos Módulos Atuais
- **Dashboard:** Central de monitoramento em tempo real por indústria e loja. (MANTER - Core)
- **Cockpit:** Visão geral rápida da operação. (MANTER - Core)
- **Gestão Operacional:** Controle de vigências e meses operacionais. (MANTER)
- **Importar Checklist:** Motor de ingestão de dados. (MANTER)
- **Roteiros:** Planejamento e execução de promotores. (MANTER)
- **Presença:** Controle de ponto e equipes. (MANTER)
- **Controle de Diárias:** Gestão financeira de freelancers. (MANTER)
- **Conciliação / Auditoria / Qualidade:** Módulos de hardening e verificação. (MANTER)

---

# MISSÃO — CONSOLIDAR INTELIGÊNCIA NO DASHBOARD E REDUZIR MÓDULOS
MK9 COMMAND CENTER

A Inteligência foi oficialmente consolidada no novo Dashboard v2.1.0.
A rota antiga foi redirecionada e o item removido da sidebar para simplificar a UX.
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
    title: "MK9 | v1.9.2 — ATENDIMENTOS INTEGRADOS",
    meta: [
      {
        name: "description",
        content: "MK9 Command Center v1.9.2: ATENDIMENTOS INTEGRADOS. Atendimentos das Diárias (Loja + N Indústrias) persistidos e validados no backend.",
      },
      { property: "og:title", content: "MK9 | v1.9.2" },
      {
        property: "og:description",
        content: "MK9 Command Center v1.9.2: ATENDIMENTOS INTEGRADOS. Atendimentos das Diárias (Loja + N Indústrias) persistidos e validados no backend.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function LandingPage() {
  const { session, loading, signOut } = useMk9Session();
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
      navigate({ to: "/dashboard", replace: true });
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
                  MK9 Command Center • <span className="text-primary/80">v1.9.2</span>
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                  ATENDIMENTOS INTEGRADOS
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
