import { createFileRoute } from "@tanstack/react-router";
import { Mk9DashboardModule } from "@/components/mk9-dashboard-module";

export const Route = createFileRoute("/dev-dash-preview")({
  ssr: false,
  component: () => (
    <div className="min-h-screen bg-background p-6">
      <Mk9DashboardModule />
    </div>
  ),
});
