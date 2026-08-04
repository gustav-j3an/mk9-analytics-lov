import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const mk9GetInternalUserDiagnostic = createServerFn({ method: "GET" })
  .handler(async () => {
    const { requireSupabaseAuth } = await import("@/integrations/supabase/auth-middleware");
    // requireSupabaseAuth is a middleware array, we need to handle it correctly or use context
    // Actually, let's just use the direct auth check for diagnostic
    const { supabase } = await import("@/integrations/supabase/client.server");
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("Unauthorized");
    
    // 1. Get auth user email
    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(user.id);
    
    // 2. Get role from mk9_user_roles
    const { data: roles } = await supabaseAdmin
      .from("mk9_user_roles")
      .select("role")
      .eq("user_id", user.id);
      
    // 3. Get profile status
    const { data: profile } = await supabaseAdmin
      .from("mk9_profiles")
      .select("active")
      .eq("user_id", user.id)
      .maybeSingle();

    return {
      userId: user.id,
      email: authUser?.email,
      roles: roles?.map(r => r.role) ?? [],
      active: profile?.active,
      timestamp: new Date().toISOString()
    };
  });
