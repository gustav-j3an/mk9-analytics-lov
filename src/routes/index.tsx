import { createFileRoute } from "@tanstack/react-router";
import { Mk9AnalyticsApp } from "@/components/mk9-analytics-app";
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    title: "Dashboard MK9 | Painel Operacional",
    meta: [
      { name: "description", content: "Sistema central de inteligência operacional MK9." },
      { property: "og:title", content: "MK9 Analytics" },
      { property: "og:description", content: "Painel operacional e relatórios automatizados." },
      { name: "twitter:card", content: "summary_large_image" }
    ],
  }),
});

function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <ClientOnly>
        <Mk9AnalyticsApp />
      </ClientOnly>
    </div>
  );
}
