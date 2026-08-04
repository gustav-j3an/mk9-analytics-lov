import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const mk9GetInternalUserDiagnostic = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const authHeader = request?.headers.get('authorization');
    
    if (!authHeader) return { error: "No authorization header found" };
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return { 
        error: "Supabase could not verify user with this token",
        details: authError?.message
      };
    }
    
    const { data: roleRows } = await supabaseAdmin
      .from("mk9_user_roles")
      .select("role")
      .eq("user_id", user.id);
      
    const { data: profile } = await supabaseAdmin
      .from("mk9_profiles")
      .select("active")
      .eq("user_id", user.id)
      .maybeSingle();

    return {
      userId: user.id,
      email: user.email,
      roles: roleRows?.map(r => r.role) ?? [],
      active: profile?.active,
      timestamp: new Date().toISOString()
    };
  });
