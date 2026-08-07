import { createFileRoute, redirect } from '@tanstack/react-router';
import { Mk9LoginForm } from '@/components/mk9-login-form';
import { useMk9Session } from '@/lib/mk9-auth/session';
import { Loader2, ShieldCheck, Database, FileCheck } from 'lucide-react';
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    title: "MK9 Analytics | Acesso",
    meta: [
      { name: "description", content: "Sistema central de inteligência operacional MK9." },
      { property: "og:title", content: "MK9 Analytics" },
      { property: "og:description", content: "Painel operacional e relatórios automatizados." },
      { name: "twitter:card", content: "summary_large_image" }
    ],
  }),
});

function LandingPage() {
  const { session, loading } = useMk9Session();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) {
    throw redirect({ to: '/cockpit' });
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <ShieldCheck className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">MK9 Analytics</h1>
          <p className="text-slate-400">
            Painel operacional para auditoria e gestão de campo.
          </p>
        </div>

        <ClientOnly>
          <Mk9LoginForm />
        </ClientOnly>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <Database className="w-5 h-5 text-blue-400 mb-2" />
            <h3 className="text-sm font-medium text-slate-200">Base Integrada</h3>
            <p className="text-xs text-slate-500">Dados consolidados de indústrias e lojas.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <FileCheck className="w-5 h-5 text-emerald-400 mb-2" />
            <h3 className="text-sm font-medium text-slate-200">Auditoria PDF</h3>
            <p className="text-xs text-slate-500">Relatórios operacionais automáticos.</p>
          </div>
        </div>
      <div className="mt-12 text-center border-t border-slate-800 pt-8">
        <h2 className="text-sm font-semibold text-rose-400 uppercase tracking-wider mb-4 underline decoration-rose-500/30 underline-offset-4">
          Status de Resolução de Erro:
        </h2>
        <div className="text-sm text-slate-300 bg-emerald-950/20 p-4 rounded-lg border border-emerald-500/20 text-left space-y-3">
          <p className="font-medium text-emerald-200 leading-relaxed">
            Analise completamente todo o projeto e identifique TODOS os bugs, erros, falhas, comportamentos inesperados e possíveis problemas existentes na aplicação.
          </p>
          <div className="space-y-4 text-slate-400 text-xs">
            <p>Seu objetivo é realizar uma auditoria técnica profunda no sistema inteiro, corrigindo problemas de lógica, frontend, backend, integração, renderização, estado, banco de dados, responsividade e performance.</p>
            
            <div className="space-y-1">
              <p className="font-semibold text-emerald-300/80">Antes de modificar qualquer coisa:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Analise toda a estrutura do projeto</li>
                <li>Analise rotas, componentes, hooks, estados globais</li>
                <li>Analise integrações, Supabase, APIs, banco de dados</li>
                <li>Analise autenticação, permissões, carregamentos</li>
                <li>Analise console errors, warnings, logs</li>
                <li>Analise comportamento da interface, responsividade</li>
                <li>Analise possíveis falhas silenciosas, segurança básica</li>
                <li>Analise fluxos completos do sistema</li>
              </ul>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-emerald-300/80">Identifique e corrija:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Bugs visuais e de navegação</li>
                <li>Erros de console e warnings</li>
                <li>Loops infinitos, problemas de renderização</li>
                <li>Re-renderizações desnecessárias</li>
                <li>Falhas de autenticação, sessão, permissões</li>
                <li>Problemas de loading, estado, sincronização</li>
                <li>Problemas de responsividade, formulários, validação</li>
                <li>Problemas em chamadas API e queries Supabase</li>
                <li>Problemas de realtime, cache, tipagem, imports</li>
                <li>Problemas de performance, UX, mobile, acessibilidade</li>
                <li>Memory leaks, requests duplicados, condições de corrida</li>
                <li>Falhas silenciosas, tratamento incorreto de erros</li>
              </ul>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-emerald-300/80">Verifique especialmente:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Fluxos de login/logout e persistência de sessão</li>
                <li>Proteção de rotas e navegação entre páginas</li>
                <li>CRUDs completos, uploads, modais</li>
                <li>Estados assíncronos, atualizações em tempo real</li>
                <li>Compatibilidade mobile e responsividade geral</li>
                <li>Componentes reutilizáveis, integrações externas</li>
              </ul>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-emerald-300/80">Regras importantes:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>NÃO remover funcionalidades sem necessidade</li>
                <li>NÃO alterar design sem motivo</li>
                <li>NÃO criar soluções temporárias</li>
                <li>Sempre aplicar soluções profissionais</li>
                <li>Priorizar estabilidade, segurança e confiabilidade</li>
                <li>Garantir código limpo e sustentável</li>
              </ul>
            </div>

            <p className="font-bold text-white mt-4 border-t border-emerald-500/20 pt-2">
              O resultado final deve deixar a aplicação estável, confiável, sem erros visíveis, fluida, responsiva e pronta para produção.
            </p>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
