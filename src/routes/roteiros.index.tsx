import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/roteiros/")({
  validateSearch: (search: Record<string, unknown>) => {
    return z.object({
      promoterId: z.string().optional(),
    }).parse(search);
  },
  loader: async (ctx) => {
    const search = ctx.deps as { promoterId?: string };
    if (!search?.promoterId) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  loaderDeps: ({ search: { promoterId } }) => ({ promoterId }),
  component: () => {
    throw redirect({
      to: "/dashboard",
    });
  }
});
