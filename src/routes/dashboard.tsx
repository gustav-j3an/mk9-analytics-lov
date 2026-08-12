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
        content:
          "Gestão operacional completa de trade marketing, o que está travando e o que fazer agora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { loading, session, roles } = useMk9Session();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        console.warn("[MK9-DASHBOARD] Usuário não autenticado em /dashboard. Redirecionando para /");
        navigate({ to: "/", replace: true });
      } else if (roles.includes("PROMOTOR") && !roles.includes("ADMIN") && !roles.includes("SUPERVISOR")) {
        console.warn("[MK9-DASHBOARD] PROMOTOR tentando acessar dashboard administrativo. Redirecionando para /mk9-portal");
        navigate({ to: "/mk9-portal", replace: true });
      }
    }
  }, [loading, session, roles, navigate]);

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
