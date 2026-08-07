import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Mk9SessionProvider } from "@/lib/mk9-auth/session";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          "O MK9 Analytics está com problema CRÍTICO de autenticação. A página de login carrega, mas NÃO CONSEGUE LOGAR.
        </h1>
        <div className="mt-4 text-left text-sm text-muted-foreground bg-muted p-4 rounded-lg overflow-auto max-h-[60vh]">
          <p className="mb-4">Como Arquiteto Técnico, siga o protocolo COMPLETO abaixo. NÃO pule etapas. NÃO faça suposições. NÃO implemente soluções paliativas.</p>
          
          <h2 className="font-bold mt-4 mb-2 border-b pb-1">1. DIAGNÓSTICO COMPLETO</h2>
          
          <h3 className="font-semibold mt-2">1.1. REPRODUZIR E CAPTURAR ERRO</h3>
          <ul className="list-disc list-inside mb-2">
            <li>Tente fazer login com credenciais válidas</li>
            <li>Capture TODOS os erros do console (F12 → Console)</li>
            <li>Capture a requisição de rede (F12 → Network → auth/login ou auth/callback)</li>
            <li>Capture se há erro de CORS, 401, 403 ou 500</li>
          </ul>

          <h3 className="font-semibold mt-2">1.2. VERIFICAR A CONFIGURAÇÃO DE AUTENTICAÇÃO</h3>
          <p>Mostre: session.tsx, client.ts, index.tsx, __root.tsx, router.tsx</p>

          <h3 className="font-semibold mt-2">1.3. VERIFICAR SUPABASE</h3>
          <p>Verifique VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e inicialização do cliente.</p>

          <h3 className="font-semibold mt-2">1.4. VERIFICAR FLUXO DE LOGIN</h3>
          <p>Verifique a função submit e a captura da sessão.</p>

          <h2 className="font-bold mt-4 mb-2 border-b pb-1">2. ANÁLISE E CAUSA RAIZ</h2>
          <p>Identifique se o erro é no Auth, RLS, Env Vars, Roteamento ou CORS.</p>

          <h2 className="font-bold mt-4 mb-2 border-b pb-1">3. PLANO DE CORREÇÃO</h2>
          <pre className="text-xs bg-black text-green-400 p-2 rounded mt-2">
            // Exemplo de correção no session.tsx...
          </pre>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MK9 Analytics" },
      { name: "description", content: "Gestão operacional de trade marketing com operações, roteiros, visitas e conciliação." },
      { name: "author", content: "MK9 Analytics" },
      { property: "og:title", content: "MK9 Analytics" },
      { property: "og:description", content: "Gestão operacional de trade marketing com operações, roteiros, visitas e conciliação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="top-right" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Mk9SessionProvider>
        <Outlet />
      </Mk9SessionProvider>
    </QueryClientProvider>
  );
}
