import { createFileRoute } from '@tanstack/react-router';
import { Mk9PortalDashboard } from '@/components/mk9-portal-dashboard';

export const Route = createFileRoute('/mk9-portal')({
  ssr: false,
  component: Mk9PortalDashboard,
  head: () => ({
    title: "MK9 | Portal do Promotor",
    meta: [
      { name: "description", content: "Área exclusiva do promotor MK9: roteiro do dia, lojas e indústrias." },
      { property: "og:title", content: "MK9 | Portal do Promotor" },
      { property: "og:description", content: "Área exclusiva do promotor MK9: roteiro do dia, lojas e indústrias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
