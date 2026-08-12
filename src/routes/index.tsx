// v3.7.1 — RESTORED LOGIN FLOW
/*
# MISSÃO — REMOVER LANDING PAGE “O FUTURO DA AUDITORIA”
## STATUS: CONCLUÍDO (v3.7.1)
- Remoção: A interface de Landing Page (Hero, Slogans, Features) foi completamente removida.
- Restauração: O componente `Mk9LoginForm` agora é o centro da página inicial para usuários não autenticados.
- Fluxo: Usuários sem sessão caem diretamente no login. Usuários autenticados seguem para Dashboard ou Portal.
- Preservação: Nenhuma alteração em lógica de sessão, roles ou no Dashboard v3.7.0.
*/

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mk9LoginForm } from "@/components/mk9-login-form";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { Loader2, Activity } from "lucide-react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    title: "MK9 | Login",
    meta: [
      {
        name: "description",
        content: "Acesso ao MK9 Command Center.",
      },
      { property: "og:title", content: "MK9 | Login" },
      {
        property: "og:description",
        content: "Acesso ao MK9 Command Center.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function LoginPage() {
  const { session, loading, roles, signOut } = useMk9Session();
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
      if (roles.includes("PROMOTOR") && !roles.includes("ADMIN") && !roles.includes("SUPERVISOR")) {
        navigate({ to: "/mk9-portal", replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [session, loading, navigate, search.session_expired, signOut]);

  if (loading || session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* Background Decorativo Sutil */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Activity className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground">
              MK9 <span className="text-primary">Analytics</span>
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
              Controle Operacional
            </p>
          </div>
        </div>

        <ClientOnly>
          <Mk9LoginForm />
        </ClientOnly>

        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-40">
          v3.7.1 — RESTORED LOGIN FLOW
        </p>
      </div>
    </div>
  );
}
