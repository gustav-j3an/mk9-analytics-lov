import { createServerFn } from "@tanstack/react-start";
import { requireMk9Role } from "./mk9-auth/require-role.server";

export const getBananaHotfixTrace = createServerFn({ method: "POST" })
  .handler(async () => {
    await requireMk9Role(["ADMIN"]);
    const { runBananaHotfix } = await import("./mk9-hotfix-runner.server");
    return runBananaHotfix();
  });
