import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Mk9AnalyticsApp } from "@/components/mk9-analytics-app";
import { createServerFn } from "@tanstack/react-start";
import { useMk9Session } from "@/lib/mk9-auth/session";

const checkAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { requireMk9Role } = await import("@/lib/mk9-auth/require-role.server");
  try {
    await requireMk9Role(["ADMIN"]);
    return true;
  } catch {
    return false;
  }
});

export const Route = createFileRoute("/cleanup")({
  ssr: false,
  component: CleanupPage,
});

function CleanupPage() {
  const { session, loading, roles } = useMk9Session();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        navigate({ to: "/", replace: true });
      } else if (roles.includes("PROMOTOR") && !roles.includes("ADMIN") && !roles.includes("SUPERVISOR")) {
        navigate({ to: "/mk9-portal", replace: true });
      }
    }
  }, [loading, session, roles, navigate]);

  if (loading || !session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#05050a]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return <Mk9AnalyticsApp />;
}
