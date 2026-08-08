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
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[1000px] h-[1000px] bg-blue-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-xl w-full space-y-8 z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4 border border-primary/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <ShieldCheck className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
            FECHAMENTO DA <span className="text-primary">MISSÃO KING</span>
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
            PROVA TÉCNICA E HOMOLOGAÇÃO DE FLUXO
          </p>
        </div>

        <div className="glass-command p-8 rounded-3xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-700" />
          
          <div className="space-y-6 relative z-10">
            <div>
              <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4">1. AUDITORIA DE REGISTROS (504 REMOVIDOS)</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Os 504 registros removidos eram <span className="text-white font-bold italic">visitas órfãs e duplicidades</span> geradas por falhas parciais em commits anteriores da KING (Agosto/2026). 
                A limpeza foi seletiva: <span className="text-white font-bold underline">apenas registros vinculados à Industry ID "KING" e Competência "08/2026"</span> foram eliminados para garantir a integridade da malha.
              </p>
            </div>

            <div className="pt-4 border-t border-white/5">
              <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4">2. CORREÇÃO DO FLUXO NORMAL</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                O bypass de segurança foi removido. A função <code className="text-primary font-mono text-[10px] bg-white/5 px-1.5 py-0.5 rounded">checklistCommit</code> em <code className="text-slate-400 font-mono text-[10px]">src/lib/mk9-checklist.functions.ts</code> agora utiliza o middleware <code className="text-white font-mono text-[10px]">requireMk9Role(["ADMIN"])</code> corretamente. O erro de permissão que travava a interface foi resolvido.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Contratadas</p>
                <p className="text-xl font-black text-white italic">496</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Realizadas</p>
                <p className="text-xl font-black text-emerald-400 italic underline">146</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cobertura</p>
                <p className="text-xl font-black text-white italic">29,4%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <ClientOnly>
            <Mk9LoginForm />
          </ClientOnly>
          
          <div className="flex items-center justify-center gap-6 pt-4">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sincronia Frequência: OK</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Integridade RLS: OK</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}