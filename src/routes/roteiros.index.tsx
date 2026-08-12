import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/roteiros/")({
  validateSearch: (search: Record<string, unknown>) => {
    return z.object({
      promoterId: z.string().optional(),
    }).parse(search);
  },
  loader: async ({ search }) => {
    if (!search.promoterId) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  component: () => {
    throw redirect({
      to: "/dashboard",
    });
  }
});
