// RPCs client → server. Cliente envia planilha como base64 + parâmetros.
// Toda a lógica pesada roda no orquestrador. Não usa auth (uso interno).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const previewSchema = z.object({
  filename: z.string().min(1),
  base64: z.string().min(4),
  operationMonth: z.number().int().min(1).max(12),
  operationYear: z.number().int().min(2020).max(2100),
  syncMode: z.enum(["full", "add_only", "registry_only", "routes_only"]),
});

const commitSchema = previewSchema.extend({ importId: z.string().uuid() });

function b64ToArrayBuffer(base64: string): ArrayBuffer {
  const bin = typeof atob === "function"
    ? atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export const mk9PreviewImport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => previewSchema.parse(data))
  .handler(async ({ data }) => {
    const { createSupabaseRepository } = await import("./mk9/persistence.server");
    const { generatePreview } = await import("./mk9/orchestrator.server");
    const repo = createSupabaseRepository();
    return generatePreview(repo, {
      buffer: b64ToArrayBuffer(data.base64),
      filename: data.filename,
      operationMonth: data.operationMonth,
      operationYear: data.operationYear,
      syncMode: data.syncMode,
    });
  });

export const mk9CommitImport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => commitSchema.parse(data))
  .handler(async ({ data }) => {
    const { createSupabaseRepository } = await import("./mk9/persistence.server");
    const { commitImport } = await import("./mk9/orchestrator.server");
    const repo = createSupabaseRepository();
    return commitImport(repo, {
      importId: data.importId,
      buffer: b64ToArrayBuffer(data.base64),
      filename: data.filename,
      operationMonth: data.operationMonth,
      operationYear: data.operationYear,
      syncMode: data.syncMode,
    });
  });

export const mk9ListImports = createServerFn({ method: "GET" }).handler(async () => {
  const { createSupabaseRepository } = await import("./mk9/persistence.server");
  return createSupabaseRepository().listImports(30);
});

export const mk9DeleteImport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ importId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("mk9_import_items").delete().eq("import_id", data.importId);
    const { error } = await supabaseAdmin.from("mk9_imports").delete().eq("id", data.importId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const mk9OverviewCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { createSupabaseRepository } = await import("./mk9/persistence.server");
  const repo = createSupabaseRepository();
  const [industries, stores, promoters] = await Promise.all([
    repo.listIndustries(),
    repo.listStores(),
    repo.listPromoters(),
  ]);
  const now = new Date();
  const routes = await repo.listPlannedRoutes(now.getMonth() + 1, now.getFullYear());
  const visits = await repo.listPlannedVisits(now.getMonth() + 1, now.getFullYear());
  return {
    industries: industries.length,
    stores: stores.length,
    promoters: promoters.length,
    routes: routes.length,
    visits: visits.length,
    completedVisits: visits.filter((v) => v.status === "completed").length,
  };
});
