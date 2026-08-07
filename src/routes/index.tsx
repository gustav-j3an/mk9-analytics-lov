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
    throw redirect({ to: '/dashboard' });
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

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Missão Ativa</h2>
          <div className="prose prose-invert prose-sm max-w-none">
            <h3 className="text-xl font-bold text-white mb-2"># MISSÃO CRÍTICA — RESTAURAR FLUXO LOGIN PRIMEIRO E EVITAR CRASH SSR</h3>
            <p className="text-slate-300">
              O MK9 Analytics está sendo restaurado para garantir que o fluxo de autenticação seja a porta de entrada única,
              evitando que módulos protegidos ou falhas de dados operacionais causem o travamento do sistema no carregamento inicial.
            </p>
            <ul className="text-xs text-slate-400 mt-4 space-y-1">
              <li>✔ Acesso inicial → Login obrigatório</li>
              <li>✔ Dashboard isolado pós-autenticação</li>
              <li>✔ Blindagem contra imports server-only no layout público</li>
              <li>✔ Tratamento de erros SSR com redirecionamento controlado</li>
            </ul>
          </div>
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
      </div>
    </div>
  );
}
