import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mk9LoginForm } from "@/components/mk9-login-form";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { Loader2, Zap, Activity, Info, Database, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    title: "MK9 | HOTFIX LOTE v1.3.1.4",
    meta: [
      {
        name: "description",
        content: "MK9 Analytics v1.3.1.4: Hotfix Estrutural de Promoção Operacional em Lote.",
      },
      { property: "og:title", content: "MK9 | v1.3.1.4" },
      {
        property: "og:description",
        content: "Cadeia de propagação corrigida: importação em lote agora ativa automaticamente a vigência operacional e alimenta Indústrias PDF.",
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
            <div className="p-2 bg-rose-500/20 rounded border border-rose-500/30">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-widest uppercase">
                HOTFIX ESTRUTURAL — PROPAGAÇÃO OPERACIONAL EM LOTE
              </h1>
              <p className="text-[10px] text-rose-500 font-black tracking-[0.3em] uppercase">
                STATUS: V1.3.1.4 — CADEIA DE PUBLICAÇÃO SINCRONIZADA
              </p>


            </div>
          </div>

          <div className="glass-command flex-1 overflow-y-auto pr-4 custom-scrollbar bg-black/40 border border-white/5 rounded-xl p-6 font-mono text-[12px] leading-relaxed">
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-200/70">
                  <h4 className="text-emerald-400 font-black uppercase text-[10px] tracking-widest mb-2">RESOLUÇÃO: LOTE → OPERACIONAL</h4>
                  <p>Identificado que o motor de lote não estava promovendo as importações para o estado "Vigente". A cadeia de commit foi unificada, garantindo que cada arquivo do lote alimente automaticamente o Dashboard e as Indústrias PDF.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Versão Vigente</span>
                    <p className="text-[11px] text-white font-bold">ATIVAÇÃO AUTOMÁTICA</p>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Indústrias PDF</span>
                    <p className="text-[11px] text-white font-bold">ALIMENTAÇÃO DIRETA</p>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Core Operacional</span>
                    <p className="text-[11px] text-white font-bold">SYNC TOTAL (v1.3.1.4)</p>
                  </div>
                </div>

                <div className="space-y-2 text-slate-400 italic">
                  <p>A partir desta versão, o status "IMPORTADO" no lote confirma que os dados já estão disponíveis em todo o ecossistema MK9 para a competência selecionada.</p>


                  
                  <div className="mt-6 p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-lg">
                    <h4 className="text-emerald-400 font-black uppercase text-[10px] tracking-widest mb-3">
                      AUDITORIA DE PARIDADE REAL (13/13)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[10px]">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">AO QUADRADO:</span>
                        <span className="text-emerald-400 font-bold">17 Lojas / 30 Visitas</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">BANANA CORRENTE:</span>
                        <span className="text-emerald-400 font-bold">8 Lojas / 150 Visitas</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1 font-bold text-white bg-purple-500/10 px-1">
                        <span className="uppercase text-purple-400">CICOPAL (FIXED):</span>
                        <span className="text-emerald-400">7 Lojas / 28 Visitas</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">KING (OPERATIONAL):</span>
                        <span className="text-emerald-400 font-bold">143 Lojas / 353 Visitas</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1 italic">
                        <span className="text-slate-500 uppercase">FRUTA POLPA:</span>
                        <span className="text-emerald-400 font-bold">25 Visitas (Alerta Realizado: 24)</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-slate-500 uppercase">SÃO BRAZ:</span>
                        <span className="text-emerald-400 font-bold">41 Lojas / 136 Visitas</span>
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatusCard icon={Activity} title="RELEASE" value="v1.3.1.4" sub="STABLE" />
                <StatusCard icon={Zap} title="PROPAGATION" value="SYNCED" sub="CORE" />


              </div>

              <div className="border-t border-white/5 pt-6 space-y-4">
                <h3 className="text-purple-400 font-black uppercase text-[10px] tracking-widest">
                  Protocolo de Estabilização
                </h3>
                <div className="space-y-4 text-slate-400">
                  <ProtocolItem
                    id="01"
                    title="UNIFICAÇÃO DO COMMIT"
                    desc="O lote agora chama exatamente o mesmo motor de commit da importação individual, eliminando divergências de processamento."
                  />
                  <ProtocolItem
                    id="02"
                    title="PROMOÇÃO AUTOMÁTICA"
                    desc="Cada arquivo processado em lote é marcado como 'Vigente' para sua competência, substituindo versões anteriores automaticamente."
                  />
                  <ProtocolItem
                    id="03"
                    title="ALIMENTAÇÃO DO CORE"
                    desc="Snapshots, Frequências e Visitas são persistidos com os IDs corretos, alimentando instantaneamente as Indústrias PDF."
                  />
                  <ProtocolItem
                    id="04"
                    title="VERIFICAÇÃO DE VIGÊNCIA"
                    desc="A lógica de resolução de importação agora garante que o sistema sempre utilize a versão mais recente confirmada no lote."
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
                  SECURE ACCESS v1.3.1.4
                </p>
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


