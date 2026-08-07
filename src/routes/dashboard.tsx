import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { Mk9AnalyticsApp } from "@/components/mk9-analytics-app";
import { useMk9Session } from "@/lib/mk9-auth/session";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MK9 Analytics — MK9 Analytics" },
      {
        name: "description",
        content:
          "MK9 Analytics MK9: saúde da operação, prioridades do dia, previsão de fechamento e situação das indústrias em uma única tela.",
      },
      { property: "og:title", content: "MK9 Analytics — MK9 Analytics" },
      {
        property: "og:description",
        content: "Gestão operacional completa de trade marketing, o que está travando e o que fazer agora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { loading, session } = useMk9Session();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirecionamento preventivo client-side se a sessão cair ou não existir
    if (!loading && !session) {
      console.warn("[MK9-DASHBOARD] Usuário não autenticado tentando acessar rota protegida. Redirecionando...");
      navigate({ to: '/', replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <Mk9AnalyticsApp />
    </div>
  );
}
