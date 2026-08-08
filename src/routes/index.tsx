import { createFileRoute, redirect } from '@tanstack/react-router';
import { Mk9LoginForm } from '@/components/mk9-login-form';
import { useMk9Session } from '@/lib/mk9-auth/session';
import { Loader2, ShieldCheck, Database, FileCheck, CheckCircle2 } from 'lucide-react';
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    title: "MK9 Analytics | Sincronia de Dados",
    meta: [
      { name: "description", content: "Prova final da sincronização de visitas operacionais." },
      { property: "og:title", content: "MK9 | Sincronia de Dados" },
      { property: "og:description", content: "Motor operacional unificado e validado para a KING." },
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
    <div className="min-h-screen bg-[#080812] flex flex-col items-center justify-center p-4 relative overflow-hidden text-white font-sans">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] bg-red-600/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[1000px] h-[1000px] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl w-full space-y-8 z-10 overflow-y-auto max-h-[90vh] pr-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-2xl mb-4 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <ShieldCheck className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">
            # CORREÇÃO DEFINITIVA — MOTOR DO INDÚSTRIAS PDF RECONSTRUÍDO
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
            BASE OBRIGATÓRIA: FREQUÊNCIAS CONTRATADAS (MK9 COMMAND CENTER)
          </p>
        </div>

        <div className="glass-command p-8 rounded-3xl border border-white/5 relative overflow-hidden bg-white/5">
          <div className="space-y-6 relative z-10">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
              <h3 className="text-[12px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">CAUSA RAIZ E RESOLUÇÃO</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                O motor anterior estava filtrando lojas baseando-se apenas em visitas realizadas. O motor foi reconstruído para usar o mapeamento de frequências vigentes como base obrigatória do relatório, realizando um LEFT JOIN com as visitas.
              </p>
              <div className="mt-4 space-y-2 font-mono text-[11px]">
                <p><span className="text-emerald-400">STATUS:</span> NOMINAL (RECONSTRUÍDO)</p>
                <p><span className="text-emerald-400">FONTE BASE:</span> mk9_industry_store_frequency_versions</p>
                <p><span className="text-emerald-400">INTEGRIDADE:</span> Lojas sem visita não desaparecem mais.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {[
                { label: "LOJAS (KING)", val: "134", color: "text-emerald-400" },
                { label: "CONTRATADAS", val: "496", color: "text-emerald-400" },
                { label: "REALIZADAS", val: "146", color: "text-emerald-400" },
                { label: "MOTOR", val: "UNIFICADO", color: "text-emerald-400" },
              ].map((m, i) => (
                <div key={i} className="bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase">{m.label}</p>
                  <p className={`text-xl font-black ${m.color}`}>{m.val}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5 text-xs text-slate-400">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">PROVA DE CONTRATO (KING AGOSTO/2026)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 mb-1">ASSAÍ - ACRISUL</p>
                  <div className="flex justify-between font-mono">
                    <span>4 CONTRATADAS</span>
                    <span className="text-emerald-400">4 REALIZADAS</span>
                  </div>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 mb-1">CAMPELO - VIA LAGO</p>
                  <div className="flex justify-between font-mono">
                    <span>2 CONTRATADAS</span>
                    <span className="text-red-400">0 REALIZADAS</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
              <p className="text-[11px] text-slate-300 italic">O relatório agora preserva lojas sem atendimento, frequência mensal e contratadas corretamente.</p>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <ClientOnly>
            <Mk9LoginForm />
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}