import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mk9AnalyticsApp } from "@/components/mk9-analytics-app";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MK9 Analytics — Gestão operacional" },
      {
        name: "description",
        content:
          "MK9 Analytics centraliza operações de trade marketing, lojas, promotores, roteiros, visitas, importações e conciliação em um painel operacional.",
      },
      { property: "og:title", content: "MK9 Analytics — Gestão operacional" },
      {
        property: "og:description",
        content: "Acesse as funcionalidades principais do MK9 Analytics em um painel de trade marketing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
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
  return <Mk9AnalyticsApp />;
}
