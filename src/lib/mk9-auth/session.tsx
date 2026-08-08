/**
 * MK9 — Hook de sessão + provider (client-side).
 * Assina supabase.auth e expõe user, roles e profile para toda a app.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeMk9Roles, type Mk9Role } from "./roles";

export type { Mk9Role };

export type Mk9SessionValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: Mk9Role[];
  profile: {
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    active: boolean;
  } | null;
  hasRole: (r: Mk9Role | Mk9Role[]) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Mk9SessionValue | null>(null);

async function loadRolesAndProfile(userId: string) {
  try {
    const [{ data: roleRows, error: roleError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase.from("mk9_user_roles").select("role").eq("user_id", userId),
        supabase
          .from("mk9_profiles")
          .select("name, email, avatar_url, active")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    if (roleError) console.error("[MK9-SESSION] Erro ao carregar roles:", roleError);
    if (profileError) console.error("[MK9-SESSION] Erro ao carregar perfil:", profileError);

    const userRoles = normalizeMk9Roles((roleRows ?? []).map((r) => r.role));

    return {
      roles: userRoles,
      profile: profile
        ? {
            name: (profile as any).name ?? null,
            email: (profile as any).email ?? null,
            avatarUrl: (profile as any).avatar_url ?? null,
            active: !!(profile as any).active,
          }
        : null,
    };
  } catch (err) {
    console.error("[MK9-SESSION] Falha crítica no carregamento de dados do usuário:", err);
    return { roles: [], profile: null };
  }
}

export function Mk9SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Mk9Role[]>([]);
  const [profile, setProfile] = useState<Mk9SessionValue["profile"]>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Fase 0.3 — isolamento de cache: qualquer troca de identidade (login, logout,
  // troca de usuário) descarta TODO o cache do TanStack Query, impedindo que
  // dados de um escopo apareçam para outro usuário no mesmo navegador.
  const identityRef = useRef<string | null | undefined>(undefined);

  async function hydrate(s: Session | null) {
    try {
      const identity = s?.user?.id ?? null;
      if (identityRef.current !== undefined && identityRef.current !== identity) {
        queryClient.clear();
      }
      identityRef.current = identity;
      setSession(s);
      if (s?.user) {
        // Carrega roles e perfil apenas se houver usuário autenticado
        const { roles, profile } = await loadRolesAndProfile(s.user.id);
        setRoles(roles);
        setProfile(profile);
      } else {
        setRoles([]);
        setProfile(null);
      }
    } catch (err) {
      console.error("[MK9-SESSION] Erro durante a hidratação da sessão:", err);
      // Em caso de erro crítico no carregamento do perfil, resetamos para segurança
      setRoles([]);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      hydrate(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!mounted) return;
      hydrate(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: Mk9SessionValue = {
    loading,
    session,
    user: session?.user ?? null,
    roles,
    profile,
    hasRole: (r) => {
      const need = Array.isArray(r) ? r : [r];
      return roles.some((x) => need.includes(x));
    },
    signOut: async () => {
      await supabase.auth.signOut();
      queryClient.clear();
    },
    refresh: async () => {
      const { data } = await supabase.auth.getSession();
      await hydrate(data.session);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMk9Session(): Mk9SessionValue {
  const v = useContext(Ctx);
  if (!v) {
    // Retorno defensivo para evitar quebra do ErrorBoundary durante SSR/Prerender se o contexto falhar
    return {
      loading: true,
      session: null,
      user: null,
      roles: [],
      profile: null,
      hasRole: () => false,
      signOut: async () => {},
      refresh: async () => {},
    };
  }
  return v;
}
