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
    title: "MK9 | v1.3.20 — EXPORTAÇÃO PDF",
    meta: [
      {
        name: "description",
        content: "MK9 Analytics v1.3.20: EXPORTAÇÃO PDF. Implementação de exportação individual de roteiros em PDF com paridade total.",
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

      <div className="max-w-md w-full z-10 flex flex-col items-center">
        <div className="w-full flex flex-col justify-center space-y-6">
          <div className="bg-black/40 border border-white/5 p-8 rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <ShieldCheck className="w-16 h-16 text-purple-400" />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col items-center mb-8">
                <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30 mb-4 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                  <Activity className="w-8 h-8 text-purple-400" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-[0.2em] uppercase text-center">
                  MK9 ANALYTICS
                </h1>
                <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-1">
                  OPERATIONAL GATEWAY
                </p>
              </div>

              <ClientOnly>
                <Mk9LoginForm />
              </ClientOnly>

              <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-1 text-center">
                <p className="text-[10px] text-slate-500 font-medium">
                  MK9 Analytics • <span className="text-purple-400/80">v1.3.20</span>
                </p>
                <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">
                  EXPORTAÇÃO PDF E GESTÃO DE ROTEIROS
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
