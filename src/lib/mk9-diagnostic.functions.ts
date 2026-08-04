import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const mk9GetInternalUserDiagnostic = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const authHeader = request?.headers.get('authorization');
    
    if (!authHeader) throw new Error("Unauthorized: No header");
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) throw new Error("Unauthorized: Invalid user");
    
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
