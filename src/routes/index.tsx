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
          <div className="inline-flex items-center justify-center p-3 bg-red-500/10 rounded-2xl mb-4 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <FileCheck className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">
            DIAGNÓSTICO <span className="text-red-500">FORENSE</span>
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
            POR QUE INDÚSTRIAS PDF NÃO CONTABILIZA AS VISITAS REALIZADAS
          </p>
        </div>

        <div className="glass-command p-8 rounded-3xl border border-white/5 relative overflow-hidden bg-white/5">
          <div className="space-y-6 relative z-10">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <h3 className="text-[12px] font-black text-red-400 uppercase tracking-[0.2em] mb-2">CAUSA RAIZ IDENTIFICADA</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                A visita deixa de ser contabilizada entre: <span className="text-white font-bold">[ETAPA F — IMPORTAÇÃO VIGENTE]</span> → <span className="text-white font-bold">[ETAPA H — FUNÇÃO QUE ALIMENTA PDF]</span>
              </p>
              <div className="mt-4 space-y-2 font-mono text-[11px]">
                <p><span className="text-red-400">ARQUIVO:</span> src/lib/mk9-operations/operational-visits.server.ts</p>
                <p><span className="text-red-400">FUNÇÃO:</span> getOperationalVisits</p>
                <p><span className="text-red-400">ERRO:</span> A função filtra pela coluna <code className="bg-white/10 px-1">is_operational_current</code>, que <span className="text-white underline">NÃO EXISTE</span> fisicamente na tabela <code className="bg-white/10 px-1">mk9_checklist_imports</code>.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: "EXCEL", val: "146", color: "text-emerald-400" },
                { label: "PERSISTIDAS", val: "146", color: "text-emerald-400" },
                { label: "DISTINCT", val: "146", color: "text-emerald-400" },
                { label: "PERÍODO", val: "146", color: "text-emerald-400" },
                { label: "OPERACIONAIS", val: "0", color: "text-red-500" },
                { label: "PDF ENGINE", val: "0", color: "text-red-500" },
              ].map((m, i) => (
                <div key={i} className="bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] font-black text-slate-500 uppercase">{m.label}</p>
                  <p className={`text-xl font-black ${m.color}`}>{m.val}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5 text-xs text-slate-400">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">DETALHAMENTO TÉCNICO (KING AGOSTO/2026)</h4>
              <ul className="space-y-2 list-disc pl-4">
                <li><span className="text-slate-300">Ciclo Operacional:</span> 23/07/2026 a 22/08/2026 (142 visitas em Julho, 4 em Agosto).</li>
                <li><span className="text-slate-300">Importação Alvo:</span> 9e868554-a9f3-4a25-acc2-51e673648512.</li>
                <li><span className="text-slate-300">Falha Lógica:</span> Como a coluna de vigência inexiste, a query de "importações ativas" falha silenciosamente, ativando um fallback que ignora todos os registros importados, aceitando apenas marcações manuais (NULL).</li>
              </ul>
            </div>
            
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">PROIBIÇÃO MANTIDA</p>
              <p className="text-[11px] text-slate-300 italic">Nenhuma alteração foi realizada no código, banco ou UI além deste relatório visual.</p>
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