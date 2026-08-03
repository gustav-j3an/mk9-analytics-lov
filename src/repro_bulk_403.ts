import { resolveMk9AccessScope } from "./lib/mk9-auth/access-scope.server";
import { supabaseAdmin } from "./integrations/supabase/client.server";

async function test() {
  console.log("--- TESTE DE REPRODUÇÃO 403 ---");
  
  const { data: profile } = await supabaseAdmin
    .from('mk9_profiles')
    .select('id, role')
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (!profile) {
    console.log("Nenhum perfil admin encontrado.");
    return;
  }

  const userId = profile.id;
  const roles = [profile.role];
  
  console.log(`Usuário: ${userId}, Roles: ${roles}`);

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
    .limit(5);

  if (!realInds) return;

  for (const ind of realInds) {
    const isAllowed = (scope.canViewAll || scope.allowedIndustryIds === null) || (scope.allowedIndustryIds && scope.allowedIndustryIds.includes(ind.id));
    console.log(`Indústria: ${ind.name} (${ind.id}) -> Permitida: ${isAllowed}`);
    
    try {
      const { assertIndustryAllowed } = await import("./lib/mk9-auth/access-scope.server");
      assertIndustryAllowed(scope, ind.id);
      console.log(`  [OK] assertIndustryAllowed passou`);
    } catch (e: any) {
      console.log(`  [FALHA] assertIndustryAllowed: ${e.message}`);
    }
  }
}

test().catch(console.error);
