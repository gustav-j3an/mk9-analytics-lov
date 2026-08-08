import { QueryCache, QueryClient, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * MK9 — Sessão expirada é um estado esperado, não um crash.
 * Qualquer erro de autenticação vindo de Server Functions limpa o cache
 * e devolve o usuário à tela de login, sem Runtime Error / tela branca.
 */
function isMk9AuthError(error: unknown): boolean {
  const err = error as { name?: string; code?: string; message?: string } | null;
  if (!err) return false;
  if (err.name === "Mk9UnauthenticatedError") return true;
  if (err.code === "UNAUTHENTICATED") return true;
  const msg = String(err.message ?? "");
  return msg.includes("Mk9UnauthenticatedError") || msg.includes("Sessão expirada");
}

let redirecting = false;

function handleAuthFailure(queryClient: QueryClient) {
  if (typeof window === "undefined" || redirecting) return;
  redirecting = true;
  void (async () => {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut();
    } catch {
      // silencioso: já estamos saindo da sessão
    } finally {
      window.location.replace("/?session_expired=true");
    }
  })();
}

export const getRouter = () => {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isMk9AuthError(error)) handleAuthFailure(queryClient);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isMk9AuthError(error)) handleAuthFailure(queryClient);
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => !isMk9AuthError(error) && failureCount < 2,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
