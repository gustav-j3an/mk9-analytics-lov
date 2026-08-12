// v3.7.3 — MISSION 2 PLAN DEPLOYED
/*
# MISSÃO 2 — EVIDÊNCIAS DE VISITA E STORAGE

**MK9 Command Center — Portal do Promotor**

## Contexto validado
A Missão 1/1.1 foi homologada.

Já existe:
* role `PROMOTOR`;
* vínculo `auth.users.id ↔ mk9_promoters.user_id`;
* `getCurrentPromoter()`;
* `getMyPromoterRoute()`;
* isolamento de dados por RLS;
* `mk9_actual_visits.promoter_id`;
* Supabase Storage já configurado para outros usos.

Ainda NÃO existe:
* upload de fotos;
* tabela de evidências;
* bucket de fotos de campo;
* GPS;
* aprovação/rejeição;
* checklist automático.

---

# OBJETIVO DA MISSÃO 2
Permitir que o Promotor:
1. abra uma visita da própria rota;
2. selecione/tire UMA foto;
3. envie a foto;
4. o sistema registre a evidência;
5. a evidência fique com status `PENDING`;
6. a foto fique armazenada de forma PRIVADA.

Ainda NÃO transformar a evidência em visita realizada.

---

# 1. CRIAR TABELA DE EVIDÊNCIAS
Criar tabela: `mk9_visit_evidence`
Campos: `id`, `promoter_id`, `planned_route_id`, `store_id`, `industry_id`, `photo_path`, `status` (PENDING, APPROVED, REJECTED), `captured_at`, `created_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`.

# 2. BUCKET PRIVADO
Criar bucket `visit-evidence` (PRIVADO). Path: `promoters/{promoterId}/{yyyy}/{mm}/{evidenceId}.jpg`.

# 3. SEGURANÇA (RLS)
* PROMOTOR: Apenas as próprias evidências. Upload apenas para seu path.
* Validação: `planned_route_id` deve pertencer ao Promotor da sessão.

# 4. COMPRESSÃO E FORMATOS
Client-side compression (max 1600px). JPEG/PNG/WEBP. Max 5MB.

# 5. REENVIO
Permitir substituir foto enquanto `PENDING`.

**NÃO iniciar Missão 3 automaticamente.**
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
          v3.7.3 — MISSION 2 PLAN DEPLOYED
        </p>
      </div>
    </div>
  );
}