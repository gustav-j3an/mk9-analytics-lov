import { resolveMk9AccessScope } from "./lib/mk9-auth/access-scope.server";
import { supabaseAdmin } from "./integrations/supabase/client.server";

async function test() {
  console.log("--- TESTE DE REPRODUÇÃO 403 (DETALHADO) ---");
  
  const { data: profiles } = await supabaseAdmin
    .from('mk9_profiles')
    .select('id, role, full_name')
    .limit(10);

  if (!profiles || profiles.length === 0) {
    console.log("Nenhum perfil encontrado.");
    return;
  }

  for (const profile of profiles) {
    const userId = profile.id;
    const roles = [profile.role];
    
    console.log(`\nTestando usuário: ${profile.full_name} (${userId}), Role: ${profile.role}`);

    const authContext = { userId, roles, devBypass: false };
    const scope = await resolveMk9AccessScope(authContext as any);
    
    console.log("Escopo resolvido:", JSON.stringify({
      role: scope.role,
      fullAccess: scope.canViewAll,
      allowedIndustryIds: scope.allowedIndustryIds,
      allowedUfs: scope.allowedUfs
    }));

    const { data: realInds } = await supabaseAdmin
      .from('mk9_industries')
      .select('id, name')
      .limit(3);

    if (realInds) {
      for (const ind of realInds) {
        try {
          const { assertIndustryAllowed } = await import("./lib/mk9-auth/access-scope.server");
          assertIndustryAllowed(scope, ind.id);
          console.log(`  [OK] ${ind.name} Permitida`);
        } catch (e: any) {
          console.log(`  [FALHA] ${ind.name}: ${e.message}`);
        }
      }
    }
  }
}

test().catch(console.error);
