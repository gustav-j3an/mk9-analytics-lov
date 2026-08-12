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
import { ThemeProvider } from "@/lib/mk9-theme/ThemeContext";
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

function isAuthError(error: unknown): boolean {
  const err = error as { statusCode?: number; name?: string; message?: string } | null;
  if (!err) return false;
  if (err.statusCode === 401) return true;
  if (err.name === "Mk9UnauthenticatedError") return true;
  const msg = String(err.message ?? "");
  return msg.includes("Mk9UnauthenticatedError") || msg.includes("Sessão expirada");
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const authError = isAuthError(error);

  useEffect(() => {
    // Sessão expirada é um estado esperado: não reportar como runtime error.
    if (authError) return;
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, authError]);

  useEffect(() => {
    if (!authError || typeof window === "undefined") return;
    const target = "/?session_expired=true";
    if (window.location.pathname + window.location.search === target) return;
    window.location.replace(target);
  }, [authError]);

  // Estado visível (nunca tela branca) enquanto a sessão é limpa.
  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Sessão expirada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua sessão expirou. Redirecionando para a tela de login…
          </p>
          <a
            href="/?session_expired=true"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o login
          </a>
        </div>
      </div>
    );
  }



  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Ops! Algo deu errado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não conseguimos carregar esta página. Pode ser um problema de conexão ou permissão.
        </p>
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "MK9 Analytics" },
      {
        name: "description",
        content:
          "Gestão operacional de trade marketing com operações, roteiros, visitas e conciliação.",
      },
      { name: "author", content: "MK9 Analytics" },
      { property: "og:title", content: "MK9 Analytics" },
      {
        property: "og:description",
        content:
          "Gestão operacional de trade marketing com operações, roteiros, visitas e conciliação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "theme-color", content: "#9b87f5" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "MK9" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/pwa-icon.svg" },
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
      <ThemeProvider>
        <Mk9SessionProvider>
          <Outlet />
        </Mk9SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
