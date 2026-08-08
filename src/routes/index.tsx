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
    <div className="min-h-screen bg-[#080812] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[1000px] h-[1000px] bg-blue-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-md w-full space-y-8 z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4 border border-primary/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
            <ShieldCheck className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase">
            MK9 <span className="text-primary">COMMAND</span> CENTER
          </h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">
            Inteligência Operacional
          </p>
        </div>

        <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-6 mb-8 shadow-[0_0_30px_rgba(168,85,247,0.05)] backdrop-blur-xl">
          <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Missão Ativa</h2>
          <div className="prose prose-invert prose-sm max-w-none">
            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter italic"># MISSÃO — CONSOLIDAR DESIGN SYSTEM</h3>
            <p className="text-slate-400 font-medium text-xs leading-relaxed">
              Consolidando a interface de comando futurista como padrão oficial para toda a malha operacional MK9 Analytics.
            </p>
            <div className="grid grid-cols-1 gap-2 mt-4">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary" /> Tokens Visuais Consolidados
              </div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary" /> Componentes Reutilizáveis READY
              </div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary" /> Referência Visual Oficial MK9
              </div>
            </div>
          </div>
        </div>

        <ClientOnly>
          <Mk9LoginForm />
        </ClientOnly>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
            <Database className="w-5 h-5 text-blue-400 mb-2" />
            <h3 className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Base Integrada</h3>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
            <FileCheck className="w-5 h-5 text-emerald-400 mb-2" />
            <h3 className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Auditoria PDF</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
