import { createServerFn } from "@tanstack/react-start";
import { requireMk9Role } from "./mk9-auth/require-role.server";

/**
 * Legado: Use a tela de Limpeza Manual, que agora utiliza o mesmo motor.
 */
export const getBananaHotfixTrace = createServerFn({ method: "POST" })
  .handler(async () => {
    await requireMk9Role(["ADMIN"]);
    const { runBananaHotfix } = await import("./mk9-hotfix-runner.server");
    return runBananaHotfix();
  });
