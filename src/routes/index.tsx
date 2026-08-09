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
    title: "MK9 | HOTFIX ENUM v1.3.1.2",
    meta: [
      {
        name: "description",
        content: "MK9 Analytics v1.3.1.2: Hotfix de Sincronização de Enum mk9_import_status.",
      },
      { property: "og:title", content: "MK9 | v1.3.1.2" },
      {
        property: "og:description",
        content: "Correção crítica de banco: Adição do valor COMPLETED_WITH_ALERTS ao enum de importação.",
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
                HOTFIX CRÍTICO — ENUM mk9_import_status DESATUALIZADO NO BANCO
              </h1>
              <p className="text-[10px] text-rose-500 font-black tracking-[0.3em] uppercase">
                STATUS: V1.3.1.2 — ENUM SINCRONIZADO
              </p>
            </div>
          </div>

          <div className="glass-command flex-1 overflow-y-auto pr-4 custom-scrollbar bg-black/40 border border-white/5 rounded-xl p-6 font-mono text-[12px] leading-relaxed">
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-lg">
                  <h4 className="text-rose-400 font-black uppercase text-[10px] tracking-widest mb-2">ERRO CONFIRMADO NA IMPORTAÇÃO EM LOTE</h4>
                  <pre className="text-[10px] text-rose-200/70 font-mono">
                    {`invalid input value for enum mk9_import_status: "COMPLETED_WITH_ALERTS"`}
                  </pre>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Função</span>
                    <p className="text-[11px] text-white font-bold">checklistCommit</p>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Etapa</span>
                    <p className="text-[11px] text-white font-bold">commit-outer</p>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Arquivo</span>
                    <p className="text-[11px] text-white font-bold">persistence.server</p>
                  </div>
                </div>

                <div className="space-y-2 text-slate-400">
                  <p>O código atual reconhece o status <code className="text-white bg-white/10 px-1">COMPLETED_WITH_ALERTS</code>, mas o enum PostgreSQL <code className="text-white bg-white/10 px-1">mk9_import_status</code> não possuía esse valor no banco.</p>
                  
                  <div className="mt-6 p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-lg">
                    <h4 className="text-emerald-400 font-black uppercase text-[10px] tracking-widest mb-3">
                      RELATÓRIO DE SINCRONIZAÇÃO
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
                      <div className="space-y-1">
                        <span className="text-slate-500 uppercase">ENUM NO BANCO (ANTES):</span>
                        <p className="text-slate-300">pending, previewing, confirmed, committing, done, failed, cancelled, INCONSISTENT</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 uppercase">STATUS ADICIONADO:</span>
                        <p className="text-emerald-400 font-bold">COMPLETED_WITH_ALERTS</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 uppercase">MIGRATION:</span>
                        <p className="text-slate-300">20260809013800_add_completed_with_alerts_status.sql</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 uppercase">RESULTADO:</span>
                        <p className="text-emerald-400 font-bold">SCHEMA SINCRONIZADO</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatusCard icon={Activity} title="RELEASE" value="v1.3.1.2" sub="HOTFIX" />
                <StatusCard icon={Database} title="SCHEMA" value="SYNCED" sub="STABLE" />
              </div>

              <div className="border-t border-white/5 pt-6 space-y-4">
                <h3 className="text-purple-400 font-black uppercase text-[10px] tracking-widest">
                  Protocolo de Estabilização
                </h3>
                <div className="space-y-4 text-slate-400">
                  <ProtocolItem
                    id="01"
                    title="NÃO MASCARAR O ERRO"
                    desc="O status COMPLETED_WITH_ALERTS agora é reconhecido oficialmente pelo banco, permitindo persistência de alertas não bloqueantes."
                  />
                  <ProtocolItem
                    id="02"
                    title="SINCRONIA TOTAL"
                    desc="Todos os status utilizados pelo TypeScript foram auditados contra as labels do enum pg_type."
                  />
                  <ProtocolItem
                    id="03"
                    title="PRESERVAÇÃO DE DADOS"
                    desc="A migration utilizou ADD VALUE, garantindo que nenhum registro existente fosse afetado ou perdido."
                  />
                  <ProtocolItem
                    id="04"
                    title="ALERTA ≠ ERRO"
                    desc="Importações com divergências zero mas alertas de formatação agora concluem com o status semântico correto."
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
                  SECURE ACCESS v1.3.1.2
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


