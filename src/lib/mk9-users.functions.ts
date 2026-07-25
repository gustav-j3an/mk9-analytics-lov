/**
 * MK9 — Gestão administrativa de usuários (Fase 4).
 * Todas as ações exigem ADMIN.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMk9Role, logAudit, type Mk9Role } from "@/lib/mk9-auth/require-role.server";

const ROLES = ["ADMIN", "SUPERVISOR", "PROMOTOR", "CLIENTE", "AUDITOR"] as const;

export type Mk9UserRow = {
  userId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Mk9Role[];
};

export const mk9ListUsers = createServerFn({ method: "GET" }).handler(async (): Promise<Mk9UserRow[]> => {
  await requireMk9Role(["ADMIN"]);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profiles, error } = await supabaseAdmin
    .from("mk9_profiles")
    .select("user_id, email, name, phone, avatar_url, active, last_login_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: roleRows, error: rErr } = await supabaseAdmin
    .from("mk9_user_roles")
    .select("user_id, role");
  if (rErr) throw new Error(rErr.message);

  const rolesByUser = new Map<string, Mk9Role[]>();
  for (const r of roleRows ?? []) {
    const list = rolesByUser.get(r.user_id as string) ?? [];
    list.push(r.role as Mk9Role);
    rolesByUser.set(r.user_id as string, list);
  }

  return (profiles ?? []).map((p: any) => ({
    userId: p.user_id,
    email: p.email ?? null,
    name: p.name ?? null,
    phone: p.phone ?? null,
    avatarUrl: p.avatar_url ?? null,
    active: !!p.active,
    lastLoginAt: p.last_login_at ?? null,
    createdAt: p.created_at,
    roles: rolesByUser.get(p.user_id) ?? [],
  }));
});

export const mk9CreateUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        role: z.enum(ROLES).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (error) throw new Error(error.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("Falha ao criar usuário.");

    // Perfil (trigger deve criar, mas garantimos os campos extras).
    await supabaseAdmin
      .from("mk9_profiles")
      .upsert(
        {
          user_id: userId,
          email: data.email,
          name: data.name ?? null,
          phone: data.phone ?? null,
          active: true,
        },
        { onConflict: "user_id" },
      );

    if (data.role) {
      await supabaseAdmin
        .from("mk9_user_roles")
        .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
    }

    await logAudit(ctx, "user.create", "mk9_profiles", userId, { email: data.email, role: data.role });
    return { userId };
  });

export const mk9SetUserActive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("mk9_profiles")
      .update({ active: data.active })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    // Ban/unban em auth.users para bloquear login real.
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    } as any);

    await logAudit(ctx, data.active ? "user.activate" : "user.deactivate", "mk9_profiles", data.userId);
    return { ok: true };
  });

export const mk9AssignRole = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(ROLES) }).parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    if (ctx.userId === data.userId && !ctx.devBypass) {
      // ADMIN pode adicionar role a si mesmo (útil), permitido.
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("mk9_user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    await logAudit(ctx, "user.role.assign", "mk9_user_roles", data.userId, { role: data.role });
    return { ok: true };
  });

export const mk9RemoveRole = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(ROLES) }).parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await requireMk9Role(["ADMIN"]);
    // Impedir que ADMIN remova seu PRÓPRIO papel ADMIN (evita lockout).
    if (ctx.userId === data.userId && data.role === "ADMIN") {
      throw new Error("Você não pode remover seu próprio papel de ADMIN.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("mk9_user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    await logAudit(ctx, "user.role.remove", "mk9_user_roles", data.userId, { role: data.role });
    return { ok: true };
  });

/** Registra timestamp de último login. Chamado pelo cliente após signIn OK. */
export const mk9RecordLogin = createServerFn({ method: "POST" }).handler(async () => {
  const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR", "PROMOTOR", "CLIENTE", "AUDITOR"]);
  if (!ctx.userId) return { ok: true };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("mk9_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("user_id", ctx.userId);
  await logAudit(ctx, "auth.login", "auth.users", ctx.userId);
  return { ok: true };
});

/** Retorna o perfil + roles do usuário autenticado atual. */
export const mk9CurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await requireMk9Role(["ADMIN", "SUPERVISOR", "PROMOTOR", "CLIENTE", "AUDITOR"]);
  if (!ctx.userId) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("mk9_profiles")
    .select("user_id, email, name, phone, avatar_url, active, last_login_at")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  return {
    userId: ctx.userId,
    email: ctx.email,
    roles: ctx.roles,
    profile: profile
      ? {
          name: profile.name ?? null,
          phone: profile.phone ?? null,
          avatarUrl: profile.avatar_url ?? null,
          active: !!profile.active,
          lastLoginAt: profile.last_login_at ?? null,
        }
      : null,
  };
});
