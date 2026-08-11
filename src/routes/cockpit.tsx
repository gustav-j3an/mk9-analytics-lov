import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cockpit")({
  loader: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
