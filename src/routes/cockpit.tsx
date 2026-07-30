import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { Mk9CockpitModule } from "@/components/mk9-cockpit-module";
import { useMk9Session } from "@/lib/mk9-auth/session";

export const Route = createFileRoute("/cockpit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cockpit Operacional — MK9 Analytics" },
      {
        name: "description",
        content:
          "Cockpit Operacional MK9: saúde da operação, prioridades do dia, previsão de fechamento e situação das indústrias em uma única tela.",
      },
      { property: "og:title", content: "Cockpit Operacional — MK9 Analytics" },
      {
        property: "og:description",
        content: "Entenda em segundos como está a operação, o que está travando e o que fazer agora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CockpitPage,
});

function CockpitPage() {
  const { loading, session } = useMk9Session();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
      <Mk9CockpitModule />
    </main>
  );
}
