import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mk9LoginForm } from "@/components/mk9-login-form";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { Loader2, Zap, Activity, Database, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    title: "MK9 | v1.3.18 — PERSISTÊNCIA MENDEZ",
    meta: [
      {
        name: "description",
        content: "MK9 Analytics v1.3.18: PERSISTÊNCIA MENDEZ. Foco no motor de inserção de visitas para resolver a falha de persistência identificada pela auditoria.",
      },
      { property: "og:title", content: "MK9 | v1.3.16" },
      {
        property: "og:description",
        content: "Analítico (Dashboard, Intelligence, PDF, Cockpit) com promoção resiliente e persistência blindada para MENDEZ.",

      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function LandingPage() {
  const { session, loading, signOut } = useMk9Session();
  const search = Route.useSearch() as { session_expired?: string };
  const navigate = useNavigate();

  useEffect(() => {
    if (search.session_expired === "true") {
      signOut();
      toast.info("Sua sessão expirou. Faça login novamente.");
      navigate({ to: "/", replace: true });
      return;
    }

    if (!loading && session) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [session, loading, navigate, search.session_expired, signOut]);

  if (loading || session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#05050a]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050a] flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-300 font-mono selection:bg-purple-500/30">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#3b0764_0%,transparent_70%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        <div className="lg:col-span-8 space-y-6 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-purple-500/20 rounded border border-purple-500/30">
              <ShieldCheck className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-widest uppercase">
                MK9 ANALYTICS — REESTRUTURAÇÃO DO ESCOPO
              </h1>
              <p className="text-[10px] text-purple-500 font-black tracking-[0.3em] uppercase">
                STATUS: v1.3.18 — PERSISTÊNCIA MENDEZ
              </p>
            </div>
          </div>

          <div className="glass-command flex-1 overflow-y-auto pr-4 custom-scrollbar bg-black/40 border border-white/5 rounded-xl p-6 font-mono text-[12px] leading-relaxed">
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-200/70">
                  <h4 className="text-emerald-400 font-black uppercase text-[10px] tracking-widest mb-2">PROTOCOLO v1.3.10: INTEGRIDADE DE SNAPSHOTS</h4>
                  <p>Universo de lojas analítico baseado estritamente no <strong>Snapshot Imutável</strong> do checklist. Promoção operacional resiliente com sincronização estrutural de frequências versionadas. Correção de falhas de status <code>committing</code> e paridade total Dashboard × PDF.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Analytics Engine</span>
                    <p className="text-[11px] text-white font-bold">CHECKLIST DRIVEN</p>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Auditoria</span>
                    <p className="text-[11px] text-white font-bold">INTEGRIDADE TOTAL</p>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Operação</span>
                    <p className="text-[11px] text-white font-bold">VISIT_CONTROLLED ONLY</p>
                  </div>
                </div>

                <div className="space-y-2 text-slate-400 italic">
                  <p>A Auditoria de Controle foi redefinida como Auditoria de Integridade Operacional: Planilha → Banco → Core → Dashboard → PDF. O sistema agora garante paridade absoluta em toda a cadeia.</p>
                  
                  <div className="mt-6 p-4 bg-purple-950/20 border border-purple-500/20 rounded-lg">
                    <h4 className="text-purple-400 font-black uppercase text-[10px] tracking-widest mb-3">
                      CONTRATO OPERACIONAL MK9
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[10px]">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">IND. MONITORADAS:</span>
                        <span className="text-emerald-400 font-bold">SOMENTE CHECKLIST</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">CONTRATADAS:</span>
                        <span className="text-emerald-400 font-bold">SUM(VISITA MENSAL)</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">AUDITORIA:</span>
                        <span className="text-emerald-400 font-bold">FLUXO DE INTEGRIDADE</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">DIVERGÊNCIAS:</span>
                        <span className="text-amber-400 font-bold">BLOQUEIO IMEDIATO</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatusCard icon={Activity} title="RELEASE" value="v1.3.18" sub="PERSISTENCE FIX" />
                <StatusCard icon={Zap} title="INTEGRITY" value="100%" sub="ANALYTIC" />
              </div>

              <div className="border-t border-white/5 pt-6 space-y-4">
                <h3 className="text-purple-400 font-black uppercase text-[10px] tracking-widest">
                  MK9 — BLINDAGEM DE PERSISTÊNCIA v1.3.18
                </h3>

                <div className="space-y-4 text-slate-400">
                  <ProtocolItem
                    id="01"
                    title="RASTREAMENTO DE ESTADO"
                    desc="Instrumentação de todas as etapas do ciclo de vida da importação para detectar a primeira transição indevida para o status CANCELLED."
                  />
                  <ProtocolItem
                    id="02"
                    title="AUDITORIA DE ESCRITA"
                    desc="Monitoramento direto das queries enviadas ao banco, verificando se triggers ou requisições concorrentes estão afetando a integridade do processo."
                  />
                  <ProtocolItem
                    id="03"
                    title="VERIFICAÇÃO DE CONCORRÊNCIA"
                    desc="Análise de duplicidade de submissões no frontend e React Strict Mode para descartar execuções paralelas que invalidam o estado atual."
                  />
                  <ProtocolItem
                    id="04"
                    title="INDÚSTRIA DE REFERÊNCIA: MENDEZ"
                    desc="Foco total na MENDEZ Julho/2026 para consolidar o diagnóstico definitivo e garantir que o status final chegue a COMPLETED."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-center space-y-6">
          <div className="bg-black/40 border border-white/5 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Database className="w-16 h-16 text-purple-400" />
            </div>
            <div className="relative z-10">
              <div className="mb-6">
                <h2 className="text-lg font-black text-white tracking-widest uppercase mb-1 italic">
                  OPERATIONAL GATE
                </h2>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                  SECURE ACCESS v1.3.18
                </p>
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400 leading-relaxed italic">
                  "Diagnóstico confirmado: o parser identifica 21 visitas para a MENDEZ, mas a persistência individual está falhando. O foco agora é rastrear o INSERT/UPSERT real para garantir que as visitas identificadas cheguem ao banco."
                </div>
              </div>
              <ClientOnly>
                <Mk9LoginForm />
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  title,
  value,
  sub,
}: {
  icon: any;
  title: string;
  value: string;
  sub: string;
}) {
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

function ProtocolItem({ id, title, desc }: { id: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-purple-500/40 font-black text-[10px] mt-0.5">{id}</span>
      <div>
        <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-widest mb-1">
          {title}
        </h4>
        <p className="text-[11px] text-slate-500 leading-tight">{desc}</p>
      </div>
    </div>
  );
}
