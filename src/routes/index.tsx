import { createFileRoute } from "@tanstack/react-router";
import { Mk9AnalyticsApp } from "@/components/mk9-analytics-app";

export const Route = createFileRoute("/")({
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
  return <Mk9AnalyticsApp />;
}
