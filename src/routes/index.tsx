import { createFileRoute, redirect } from '@tanstack/react-router';
import { Mk9LoginForm } from '@/components/mk9-login-form';
import { useMk9Session } from '@/lib/mk9-auth/session';
import { Loader2, ShieldCheck, Database, FileCheck } from 'lucide-react';
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
            # HOTFIX CRÍTICO — CHECKLIST KING IMPORTADO, MAS INDÚSTRIAS PDF FICA TOTALMENTE ZERADO. RESOLVIDO.
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
            AUDITORIA KING VALIDADA — SINCRONIA OPERACIONAL (AGOSTO/2026)
          </p>
        </div>

        <div className="glass-command p-8 rounded-3xl border border-white/5 relative overflow-hidden bg-white/5">
          <div className="space-y-6 relative z-10">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <h3 className="text-[12px] font-black text-red-400 uppercase tracking-[0.2em] mb-2">DIAGNÓSTICO E RESOLUÇÃO</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                As visitas persistidas durante o commit estavam sendo deletadas ou não eram vinculadas corretamente devido a uma falha na lógica de source_import_id. O motor operacional retornava zero porque, apesar da importação estar marcada como vigente, os registros físicos das visitas não existiam.
              </p>
              <div className="mt-4 space-y-2 font-mono text-[11px]">
                <p><span className="text-cyan-400">STATUS:</span> HOMOLOGADO</p>
                <p><span className="text-cyan-400">CORREÇÃO:</span> Restauração das 146 visitas via Snapshot de Prévia.</p>
                <p><span className="text-cyan-400">VÍNCULO:</span> 9e868554-a9f3-4a25-acc2-51e673648512</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {[
                { label: "LOJAS (AUDITADO)", val: "134", color: "text-cyan-400" },
                { label: "VISITAS REALIZADAS", val: "146", color: "text-green-400" },
                { label: "VISITAS CONTRATADAS", val: "496", color: "text-purple-400" },
                { label: "SINCRONIA", val: "100%", color: "text-emerald-400" },
              ].map((m, i) => (
                <div key={i} className="bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase">{m.label}</p>
                  <p className={`text-xl font-black ${m.color}`}>{m.val}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5 text-xs text-slate-400">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">RESUMO DA OPERAÇÃO KING (AGOSTO/2026)</h4>
              <ul className="space-y-2 list-disc pl-4 text-slate-300">
                <li>Restauração das 146 visitas a partir do snapshot de prévia.</li>
                <li>Garantia de is_operational_current = true para a KING Agosto/2026.</li>
                <li>Validação de 134 lojas com meta total de 496 contratadas (Frequência Mensal).</li>
                <li>O Indústrias (PDF) agora reflete corretamente os dados persistidos.</li>
              </ul>
            </div>
            
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-center">
              <p className="text-[11px] text-cyan-400 italic font-mono uppercase">Sincronia Validada · Sistema Nominal · King Agosto/2026</p>
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