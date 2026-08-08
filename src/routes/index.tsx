import { createFileRoute, redirect } from '@tanstack/react-router';
import { Mk9LoginForm } from '@/components/mk9-login-form';
import { useMk9Session } from '@/lib/mk9-auth/session';
import { Loader2, Zap, BarChart3, Shield, Cpu, Activity, Info } from 'lucide-react';
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    title: "MK9 | FASE 3 — CONFIABILIDADE & TESTES",
    meta: [
      { name: "description", content: "Fase 3: Proteção contra regressão, testes de contrato e integridade operacional." },
      { property: "og:title", content: "MK9 | FASE 3" },
      { property: "og:description", content: "Missão de blindagem e testes automatizados para o MK9 Analytics." },
      { name: "twitter:card", content: "summary_large_image" }
    ],
  }),

});

function LandingPage() {
  const { session, loading } = useMk9Session();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#05050a]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (session) {
    throw redirect({ to: '/dashboard' });
  }

  return (
    <div className="min-h-screen bg-[#05050a] flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-300 font-mono selection:bg-purple-500/30">
      {/* Matrix-like Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#3b0764_0%,transparent_70%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        {/* Left Column: Mission Status */}
        <div className="lg:col-span-8 space-y-6 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-purple-500/20 rounded border border-purple-500/30">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-widest uppercase">
                MK9 — FASE 3
              </h1>
              <p className="text-[10px] text-purple-400 font-black tracking-[0.3em] uppercase">
                CONFIABILIDADE, TESTES DE CONTRATO E PROTEÇÃO
              </p>
            </div>
          </div>

          <div className="glass-command flex-1 overflow-y-auto pr-4 custom-scrollbar bg-black/40 border border-white/5 rounded-xl p-6 font-mono text-[12px] leading-relaxed">
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 text-white mb-3">
                  <Info className="w-4 h-4 text-purple-400" />
                  <span className="font-black uppercase tracking-widest">Contexto</span>
                </div>
                <div className="text-slate-400 space-y-2">
                  <p>A Fase 2 de Performance foi concluída com sucesso (Paralelização, Cockpit consolidado, listBulkActualVisits). Agora o objetivo NÃO é adicionar funcionalidades.</p>
                  <p>A Missão é impedir que futuras alterações voltem a quebrar: frequência, contratadas, realizadas, pendentes, extras, Indústrias PDF, importação e o período KING.</p>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatusCard icon={Activity} title="CONTRACT" value="VALIDATED" sub="Parity" />
                <StatusCard icon={Cpu} title="ENGINES" value="TESTED" sub="Automated" />
                <StatusCard icon={Shield} title="REGRESSION" value="ZERO-TOL" sub="Safety" />
                <StatusCard icon={BarChart3} title="KING RULES" value="LOCKED" sub="Compliance" />
              </div>

              <div className="border-t border-white/5 pt-6 space-y-4">
                <h3 className="text-purple-400 font-black uppercase text-[10px] tracking-widest">PROTOCOLOS DE PROTEÇÃO</h3>
                <div className="space-y-4 text-slate-400">
                  <ProtocolItem id="01" title="TESTES DE CONTRATO DO MOTOR" desc="Garantir que Dashboard, Cockpit e PDF retornem exatamente os mesmos números-base." />
                  <ProtocolItem id="02" title="VALIDAÇÃO DE FREQUÊNCIA" desc="Bloquear regressões de cálculo (4→3, 8→6, 2→1) em lojas com frequências fixas." />
                  <ProtocolItem id="03" title="INTEGRIDADE DE LOJAS SEM VISITA" desc="Garantir que lojas contratadas sem visitas continuem aparecendo nos relatórios." />
                  <ProtocolItem id="04" title="MOTOR DE EXTRAS & PENDENTES" desc="Validar logicamente que extras = max(0, realizado-contratado) e pendentes = max(0, contratado-realizado)." />
                  <ProtocolItem id="05" title="SINCRONIA DE IMPORTAÇÃO" desc="Testar substituição atômica e reversão de checklists mantendo o histórico operacional." />
                  <ProtocolItem id="06" title="REGRA KING IMUTÁVEL" desc="Proteção específica para o período operacional customizado (23/07 → 22/08) e frequências não proporcionais." />
                  <ProtocolItem id="07" title="SNAPSHOT IMMUTABILITY" desc="Validar que o PDF utiliza o snapshot imutável gerado no momento do commit do checklist." />
                </div>
              </div>

              <div className="bg-purple-900/20 border border-purple-500/20 p-4 rounded-lg">
                <p className="text-purple-300 font-black uppercase text-[9px] tracking-widest mb-1">MISSÃO DE BLINDAGEM</p>
                <p className="text-[10px] text-purple-200/60 leading-tight">
                  Se qualquer alteração futura tentar reduzir números homologados ou causar divergência entre PDF e Dashboard, a suíte de testes deve falhar automaticamente.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Login */}
        <div className="lg:col-span-4 flex flex-col justify-center space-y-6">
          <div className="bg-black/40 border border-white/5 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Shield className="w-16 h-16 text-purple-500" />
             </div>
             <div className="relative z-10">
               <div className="mb-6">
                 <h2 className="text-lg font-black text-white tracking-widest uppercase mb-1 italic">ACCESS CONTROL</h2>
                 <p className="text-[9px] text-slate-500 uppercase tracking-widest">SECURE OPERATIONAL GATEWAY</p>
               </div>
               <ClientOnly>
                 <Mk9LoginForm />
               </ClientOnly>
             </div>
          </div>

          <div className="text-center">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">
              MK9 DATA SCIENCE UNIT
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, title, value, sub }: { icon: any, title: string, value: string, sub: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-4">
      <div className="p-2 bg-purple-500/10 rounded">
        <Icon className="w-4 h-4 text-purple-400" />
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-black text-white italic">{value}</span>
          <span className="text-[8px] text-purple-500/60 uppercase font-black">{sub}</span>
        </div>
      </div>
    </div>
  );
}

function ProtocolItem({ id, title, desc }: { id: string, title: string, desc: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-purple-500/40 font-black text-[10px] mt-0.5">{id}</span>
      <div>
        <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-widest mb-1">{title}</h4>
        <p className="text-[11px] text-slate-500 leading-tight">{desc}</p>
      </div>
    </div>
  );
}
