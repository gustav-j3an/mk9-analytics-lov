import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Só transforma em página 500 HTML erros de navegação SSR (rota de página).
// Para chamadas de server function (/_serverFn/…) precisamos deixar o erro
// bubblar para o TanStack serializar — senão o cliente recebe apenas
// "Bad Request (HTTP 400)" sem detalhe algum.
function isServerFnRequest(): boolean {
  try {
    // getRequest é acessível dentro de handlers server. Fallback seguro: false.
    const req: Request | undefined = (globalThis as any).__mk9Request;
    if (!req) return false;
    return new URL(req.url).pathname.startsWith("/_serverFn");
  } catch {
    return false;
  }
}

const errorMiddleware = createMiddleware().server(async ({ next, request }: any) => {
  if (request) (globalThis as any).__mk9Request = request;
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) throw error;
    // Server functions: rethrow para que o TanStack devolva a mensagem estruturada.
    const url = request?.url ?? "";
    if (typeof url === "string" && url.includes("/_serverFn")) throw error;
    if (isServerFnRequest()) throw error;
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
