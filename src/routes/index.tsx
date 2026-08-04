import { createFileRoute } from "@tanstack/react-router";
import { Mk9AnalyticsApp } from "@/components/mk9-analytics-app";
import { ClientOnly } from "@/components/client-only";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { Mk9LoginForm } from "@/components/mk9-login-form";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  head: () => ({
    title: "MK9 Analytics | Login",
    meta: [
      { name: "description", content: "Sistema central de inteligência operacional MK9." },
      { property: "og:title", content: "MK9 Analytics" },
      { property: "og:description", content: "Painel operacional e relatórios automatizados." },
      { name: "twitter:card", content: "summary_large_image" }
    ],
  }),
});

function DashboardPage() {
  const sessionData = useMk9Session();
  
  if (!sessionData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <p className="text-destructive">Erro: Session Provider não encontrado.</p>
      </div>
    );
  }

  const { session, loading } = sessionData;

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Mk9LoginForm />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ClientOnly fallback={
        <div className="h-screen w-full flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <Mk9AnalyticsApp />
      </ClientOnly>
    </div>
  );
}

