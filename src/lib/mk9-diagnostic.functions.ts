import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const mk9GetInternalUserDiagnostic = createServerFn({ method: "GET" })
  .handler(async () => {
    const { requireSupabaseAuth } = await import("@/integrations/supabase/auth-middleware");
    const { userId } = await requireSupabaseAuth();
    
    // 1. Get auth user email
    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    // 2. Get role from mk9_user_roles
    const { data: roles } = await supabaseAdmin
      .from("mk9_user_roles")
      .select("role")
      .eq("user_id", userId);
      
    // 3. Get profile status
    const { data: profile } = await supabaseAdmin
      .from("mk9_profiles")
      .select("active")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      userId,
      email: authUser?.email,
      roles: roles?.map(r => r.role) ?? [],
      active: profile?.active,
      timestamp: new Date().toISOString()
    };
  });
