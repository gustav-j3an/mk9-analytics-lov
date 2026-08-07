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
          Analise todo o projeto de forma completa antes de realizar qualquer alteração e execute uma refatoração profunda e estruturada em toda a base de código.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu objetivo é melhorar a qualidade interna do sistema sem alterar funcionalidades ou comportamento visível da aplicação.
          {"\n\n"}
          A refatoração deve tornar o código mais limpo, organizado, escalável, padronizado e fácil de manter.
          {"\n\n"}
          Realize uma revisão completa de:
          {"\n"}- Estrutura de pastas e organização do projeto
          {"\n"}- Componentes e sua reutilização
          {"\n"}- Hooks customizados, lógica de estado
          {"\n"}- Services e camadas de API
          {"\n"}- Integração com Supabase, queries
          {"\n"}- Fluxos de autenticação, rotas
          {"\n"}- Tipagem, lógica duplicada ou redundante
          {"\n"}- Funções grandes ou mal divididas
          {"\n"}- Acoplamento excessivo entre componentes
          {"\n"}- Imports desorganizados
          {"\n"}- Regras de negócio misturadas com UI
          {"\n\n"}
          Objetivos principais:
          {"\n"}- Reduzir duplicação de código
          {"\n"}- Melhorar legibilidade e separação de responsabilidades
          {"\n"}- Melhorar reutilização de componentes
          {"\n"}- Criar padrões consistentes no projeto
          {"\n"}- Facilitar manutenção futura
          {"\n"}- Reduzir complexidade desnecessária
          {"\n"}- Melhorar escalabilidade
          {"\n\n"}
          Diretrizes:
          {"\n"}- NÃO alterar funcionalidades existentes
          {"\n"}- NÃO mudar comportamento da interface
          {"\n"}- NÃO quebrar fluxos já existentes
          {"\n"}- Priorizar separação de responsabilidades (UI / lógica / dados)
          {"\n"}- Componentização inteligente e reutilização
          {"\n"}- Nomeação clara e consistente
          {"\n"}- Organização por domínio ou feature
          {"\n\n"}
          Resultado esperado: projeto muito mais organizado, fácil de entender e manter, escalável, livre de duplicações, com arquitetura profissional e padrões consistentes.
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
