import { createFileRoute, redirect } from '@tanstack/react-router';
import { Mk9LoginForm } from '@/components/mk9-login-form';
import { useMk9Session } from '@/lib/mk9-auth/session';
import { Loader2, ShieldCheck, Database, FileCheck, CheckCircle2, TrendingUp, AlertTriangle, Building2, MapPin } from 'lucide-react';
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    title: "MK9 Analytics | Dashboard Analítico V1",
    meta: [
      { name: "description", content: "Inteligência Operacional e análise de dados em tempo real." },
      { property: "og:title", content: "MK9 Analytics | Dashboard V1" },
      { property: "og:description", content: "Visualização avançada de performance, malha e execução operacional." },
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
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[1000px] h-[1000px] bg-blue-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl w-full space-y-8 z-10 overflow-y-auto max-h-[90vh] pr-4 custom-scrollbar">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-purple-500/10 rounded-2xl mb-4 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <TrendingUp className="w-12 h-12 text-purple-500" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">
            # MK9 ANALYTICS — DASHBOARD ANALÍTICO V1
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
            Inteligência Operacional · Business Intelligence · Science-Driven
          </p>
        </div>

        <div className="glass-command p-8 rounded-3xl border border-white/5 relative overflow-hidden bg-white/5">
          <div className="space-y-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-[12px] font-black text-purple-400 uppercase tracking-[0.2em]">OBJETIVO DO SISTEMA</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Transformamos o cockpit operacional em uma central de inteligência. O foco agora é a análise profunda da malha: 
                  Indústria → Loja → Frequência → Execução.
                </p>
                <div className="flex flex-wrap gap-2">
                  <BadgeItem icon={Building2} label="INDÚSTRIA" />
                  <BadgeItem icon={MapPin} label="UF" />
                  <BadgeItem icon={Database} label="DADOS REAIS" />
                </div>
              </div>

              <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-[12px] font-black text-emerald-400 uppercase tracking-[0.2em]">STATUS DA OPERAÇÃO</h3>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase">Lojas Auditadas</p>
                      <p className="text-xl font-black text-white italic">134</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase">Visitas Reais</p>
                      <p className="text-xl font-black text-white italic">146</p>
                   </div>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" /> SINCRONIA VALIDADA
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-white/5">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">PILORES ANALÍTICOS</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <AnalyticFeature 
                  title="DISTRIBUIÇÃO" 
                  desc="Análise dinâmica de frequências por indústria." 
                />
                <AnalyticFeature 
                  title="CURVA DE EVOLUÇÃO" 
                  desc="Ritmo de execução vs meta contratada." 
                />
                <AnalyticFeature 
                  title="CRITICIDADE" 
                  desc="Identificação instantânea de lojas zero visitas." 
                />
              </div>
            </div>
            
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-center">
              <p className="text-[11px] text-slate-300 italic font-medium">O Dashboard Analítico v1 consome os motores homologados sem alterar regras de negócio.</p>
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

function BadgeItem({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
      <Icon className="h-3 w-3 text-purple-400" />
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{label}</span>
    </div>
  );
}

function AnalyticFeature({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
      <p className="text-[10px] font-black text-white mb-1 tracking-tighter">{title}</p>
      <p className="text-[10px] text-slate-500 leading-tight">{desc}</p>
    </div>
  );
}