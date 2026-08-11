/*
# Contexto do Projeto — MK9 Command Center (ex-MK9 Analytics)

Use este prompt para me dar (ou dar a outra IA, ex: Lovable) o contexto completo do projeto antes de pedir qualquer ajuste ou nova feature.

## O que é o projeto
Sistema interno de gestão de promotores de campo (trade marketing), usado para controlar roteiros, checklists de visitas, indústrias atendidas, lojas, promotores e relatórios financeiros/operacionais. Rebatizado de "MK9 Analytics" para "MK9 Command Center" (identidade visual do dashboard), mas ainda é chamado de MK9 Analytics internamente.

## Stack atual
React, TypeScript, TanStack Start, Supabase, Postgres, Tailwind, shadcn/ui, Server Functions, SSR.

**Regra importante: não reconstruir do zero, não trocar stack, não redesenhar arquitetura sem necessidade real. O objetivo é continuidade, correção de regressões e evolução seguindo o que já existe.**

## Design system
Personalização global de temas (Light/Dark) com tokens oklch semânticos. Accent roxo neon (Command Purple), suporte azul/ciano, visual SaaS enterprise moderno.

## Módulos do sistema
- **Operação:** Cockpit (Visão Geral), Conciliação/Auditoria, Qualidade, Gestão Operacional, Importar Checklist, Roteiros, Presença, Equipes, Freelancers e Diárias.
- **Relatórios:** Indústrias PDF.
- **Financeiro:** Fechamento de Diárias, Gestão de Pagamentos.
- **Cadastros:** Indústrias, Lojas, Promotores, Supervisores, Freelancers.
- **Administração:** Limpeza Manual, Usuários.

## Dados de referência
- 27 indústrias no banco (26 ativas, 1 arquivada) — ex: KING, COPRA, COOPATOS, AO QUADRADO, EMBAVI, RB ALIMENTOS.
- KING tem competência operacional própria (não é mês calendário) — ex: 23/mês anterior a 22/mês atual.

## Funcionalidades Recentes (v1.6.0 - v1.8.0)
- **Personalização Global (v1.6.0):** Tema claro/escuro nativo com cores personalizáveis.
- **Sidebar Optimized (v1.7.0):** Recolhimento persistente, tooltips e design compacto.
- **Light Mode Corrected (v1.8.1):** Correção sistêmica de contraste em Selects, Inputs, Dropdowns e DatePickers, eliminando textos brancos sobre fundo claro.
- **Freelancers & Global UI (v1.8.4):** Estabilização do módulo de Freelancers, botões globais e componentes de Empty State para legibilidade total no tema claro.
- **Diárias Data Fix (v1.8.5):** Correção crítica na separação de conceitos entre Loja e Indústria no formulário de Nova Diária.
- **Dashboard Optimized (v1.8.7):** Matriz de Execução recolhível por padrão e correção de reatividade na sidebar.

## Processo obrigatório de conclusão de tarefa
Reproduzir -> achar causa raiz -> identificar arquivo/função -> corrigir -> validar no preview (login, dashboard, sidebar, rota afetada, refresh) — só então considerar concluído.

## Prioridades atuais
- Estabilizar o fluxo financeiro de Freelancers.
- Manter paridade entre Dashboard/Cockpit/PDF.
- Garantir reatividade total (invalidação de cache) em todos os CRUDs.

---

**Peça específico de hoje:** [descreva aqui o que você quer resolver ou construir agora]
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
    title: "MK9 | v1.8.7 — DASHBOARD OPTIMIZED",
    meta: [
      {
        name: "description",
        content: "MK9 Command Center v1.8.7: DASHBOARD OPTIMIZED. Matriz de Execução inteligente e melhorias de UX na sidebar.",
      },
      { property: "og:title", content: "MK9 | v1.8.7" },
      {
        property: "og:description",
        content: "MK9 Command Center v1.8.7: DASHBOARD OPTIMIZED. Matriz de Execução inteligente e melhorias de UX na sidebar.",
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
                  MK9 Command Center • <span className="text-primary/80">v1.8.7</span>
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                  DASHBOARD OPTIMIZED
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
