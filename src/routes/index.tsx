import { createFileRoute, redirect } from '@tanstack/react-router';
import { Mk9LoginForm } from '@/components/mk9-login-form';
import { useMk9Session } from '@/lib/mk9-auth/session';
import { Loader2, Zap, BarChart3, Shield, Cpu, Activity, Info } from 'lucide-react';
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    title: "MK9 | FASE 5 — ACABAMENTO & V1.0",
    meta: [
      { name: "description", content: "Fase 5: Acabamento de produto, refinamento visual e preparação para a versão estável v1.0." },
      { property: "og:title", content: "MK9 | FASE 5" },
      { property: "og:description", content: "Refinamento visual, consistência e estabilização para a versão 1.0." },

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
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-widest uppercase">
                MK9 — FASE 5
              </h1>
              <p className="text-[10px] text-purple-400 font-black tracking-[0.3em] uppercase">
                ACABAMENTO DE PRODUTO E PREPARAÇÃO V1.0
              </p>

            </div>
          </div>

          <div className="glass-command flex-1 overflow-y-auto pr-4 custom-scrollbar bg-black/40 border border-white/5 rounded-xl p-6 font-mono text-[12px] leading-relaxed">
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 text-white mb-3">
                  <Info className="w-4 h-4 text-purple-400" />
                  <span className="font-black uppercase tracking-widest">Contexto Atual</span>
                </div>
                <div className="text-slate-400 space-y-2">
                  <p>O MK9 Analytics chegou a um estado avançado e estável.</p>
                  <p className="text-purple-400/80 font-bold mt-2">ESTADO HOMOLOGADO:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-[11px]">
                    <li>Fase 2 — Performance e Estabilidade: concluída</li>
                    <li>Fase 3 — Confiabilidade: concluída</li>
                    <li>Fase 4 — Inteligência Analítica: concluída</li>
                    <li>384 testes aprovados</li>
                    <li>Dashboard == PDF == Auditoria</li>
                    <li>KING = 146 visitas realizadas em paridade</li>
                    <li>Command Center / Score de Risco / Projeção ativos</li>
                  </ul>
                  <p className="mt-4">A partir de agora: NÃO estamos desenvolvendo novas regras operacionais. Estamos preparando o MK9 Analytics para uma versão estável v1.0.</p>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatusCard icon={Activity} title="UI/UX" value="REFINING" sub="Polishing" />
                <StatusCard icon={Cpu} title="STABILITY" value="HOMOLOGATED" sub="v1.0" />
                <StatusCard icon={Zap} title="PERFORMANCE" value="OPTIMIZED" sub="Edge" />
                <StatusCard icon={Shield} title="SECURITY" value="HARDENED" sub="RLS" />

              </div>

              <div className="border-t border-white/5 pt-6 space-y-4">
                <h3 className="text-purple-400 font-black uppercase text-[10px] tracking-widest">OBJETIVOS DA FASE 5 — ACABAMENTO</h3>
                <div className="space-y-4 text-slate-400">
                  <ProtocolItem id="01" title="VISUAL CONSISTENTE" desc="Auditoria de espaçamento, tipografia, cores e design system unificado em todos os módulos." />
                  <ProtocolItem id="02" title="HIERARQUIA & DENSIDADE" desc="Padronização de Page Headers, filtros ativos e tabelas analíticas com foco em leitura rápida." />
                  <ProtocolItem id="03" title="FEEDBACK & ERROS" desc="Melhoria de loading states (skeletons), empty states e feedback de ações com confirmações destrutivas." />
                  <ProtocolItem id="04" title="RESPONSIVIDADE DESKTOP" desc="Otimização para notebooks 1366x768 e telas 1920x1080 garantindo KPIs sempre visíveis." />
                  <ProtocolItem id="05" title="SIDEBAR & NAVEGAÇÃO" desc="Nova sidebar agrupada, colapsável e breadcrumbs inteligentes para melhorar o fluxo de uso." />
                  <ProtocolItem id="06" title="PROTEÇÃO DO CORE" desc="Refinamento estético absoluto SEM alterar regras de negócio, parsers ou cálculos operacionais." />
                  <ProtocolItem id="07" title="ESTABILIDADE V1.0" desc="Ponto de restauração estável, documentação técnica atualizada e suíte de testes (npm run verify) verde." />
                </div>
              </div>

              <div className="bg-purple-900/20 border border-purple-500/20 p-4 rounded-lg">
                <p className="text-purple-300 font-black uppercase text-[9px] tracking-widest mb-1">MK9 PRODUCT UNIT</p>
                <p className="text-[10px] text-purple-200/60 leading-tight">
                  A Fase 5 é sobre polir, padronizar e estabilizar. O objetivo é entregar um produto profissional, previsível e resistente a erros para uso diário.
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
