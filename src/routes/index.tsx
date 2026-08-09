import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mk9LoginForm } from "@/components/mk9-login-form";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { Loader2, Zap, BarChart3, Shield, Cpu, Activity, Info, Database } from "lucide-react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    title: "MK9 | SISTEMA HOMOLOGADO v1.2.1",
    meta: [
      {
        name: "description",
        content: "MK9 Analytics v1.2.1: Hotfix de Pipeline de Importação (Snapshots).",
      },
      { property: "og:title", content: "MK9 | v1.2.1" },
      {
        property: "og:description",
        content: "Painel de inteligência operacional com pipeline de dados estabilizado.",
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
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-widest uppercase">
                MK9 ANALYTICS — SISTEMA HOMOLOGADO
              </h1>
              <p className="text-[10px] text-emerald-500 font-black tracking-[0.3em] uppercase">
                STATUS: V1.2.1 — HOTFIX DE PIPELINE E SNAPSHOTS
              </p>
            </div>
          </div>

          <div className="glass-command flex-1 overflow-y-auto pr-4 custom-scrollbar bg-black/40 border border-white/5 rounded-xl p-6 font-mono text-[12px] leading-relaxed">
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 text-white mb-3">
                  <Info className="w-4 h-4 text-purple-400" />
                  <span className="font-black uppercase tracking-widest text-purple-400">
                    Notas de Versão v1.2.1
                  </span>
                </div>
                <div className="text-slate-400 space-y-2">
                  <p>
                    A versão 1.2.1 corrige uma falha crítica no pipeline de importação de checklists. A tabela de snapshots imutáveis foi restaurada e as políticas de segurança (RLS) foram endurecidas usando o schema privado mk9_private.
                  </p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] mt-4">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>Testes (npm verify)</span>
                      <span className="text-emerald-400 font-bold">391 PASS</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>Pipeline Snapshot</span>
                      <span className="text-emerald-400 font-bold">RESTAURADO</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span>Security Hardening</span>
                      <span className="text-emerald-400 font-bold">mk9_private</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                     <span>Importação Lote</span>
                      <span className="text-emerald-400 font-bold">ESTABILIZADA</span>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatusCard icon={Activity} title="RELEASE" value="v1.2.1" sub="STABLE" />
                <StatusCard icon={Database} title="DATABASE" value="SNAPSHOTS" sub="FIXED" />
              </div>

              <div className="border-t border-white/5 pt-6 space-y-4">
                <h3 className="text-purple-400 font-black uppercase text-[10px] tracking-widest">
                  Protocolo v1.2.1
                </h3>
                <div className="space-y-4 text-slate-400">
                  <ProtocolItem
                    id="01"
                    title="RESTAURAÇÃO DE SNAPSHOTS"
                    desc="Recriação da tabela mk9_checklist_import_store_snapshots e correção do erro 'schema cache' na persistência."
                  />
                  <ProtocolItem
                    id="02"
                    title="HARDENING DE RLS"
                    desc="Migração de políticas para usar mk9_private.is_mk9_admin(), garantindo isolamento total e performance."
                  />
                  <ProtocolItem
                    id="03"
                    title="ESTABILIZAÇÃO DO LOTE"
                    desc="Sincronização do motor de commit em lote para reutilizar o pipeline de persistência imutável homologado."
                  />
                  <ProtocolItem
                    id="04"
                    title="AUDITORIA E INTEGRIDADE"
                    desc="Validação de 391 testes e garantia de paridade KING (146 visitas) pós-correção de banco."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-center space-y-6">
          <div className="bg-black/40 border border-white/5 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Shield className="w-16 h-16 text-purple-400" />
            </div>
            <div className="relative z-10">
              <div className="mb-6">
                <h2 className="text-lg font-black text-white tracking-widest uppercase mb-1 italic">
                  OPERATIONAL GATE
                </h2>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                  SECURE ACCESS v1.2.1
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
