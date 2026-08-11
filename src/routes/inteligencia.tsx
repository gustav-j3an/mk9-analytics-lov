import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/inteligencia")({
  loader: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
