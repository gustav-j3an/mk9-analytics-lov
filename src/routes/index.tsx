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
      <div className="flex h-screen w-full items-center justify-center bg-[#080812]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) {
    throw redirect({ to: '/dashboard' });
  }

  return (
    <div className="min-h-screen bg-[#080812] flex flex-col items-center justify-center p-4">
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

        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6 mb-8 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
          <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4">Missão Concluída</h2>
          <div className="prose prose-invert prose-sm max-w-none">
            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter"># MISSÃO — REDESIGN COMMAND CENTER</h3>
            <p className="text-slate-400 font-medium text-xs leading-relaxed">
              O MK9 Analytics foi transformado em um Centro de Controle Operacional Premium com interface futurista e visual tecnológico de alto impacto.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-emerald-500" /> Interface Futurista
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-emerald-500" /> Command Center UI
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-emerald-500" /> Sidebar Premium Dark
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-emerald-500" /> Neon Glassmorphism
              </div>
            </div>
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
