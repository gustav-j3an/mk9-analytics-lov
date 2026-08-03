import { resolveMk9AccessScope } from "./lib/mk9-auth/access-scope.server";
import { canReadIndustry, assertIndustryAllowed } from "./lib/mk9-auth/access-scope.server";

async function verify() {
  console.log("--- VERIFICAÇÃO HOTFIX ESCOPO ---");

  // Mock de escopo ADMIN (canViewAll: true, allowedIndustryIds: null)
  const adminScope: any = {
    role: "ADMIN",
    canViewAll: true,
    allowedIndustryIds: null,
    allowedUfs: null
  };

  const industryId = "57376220-55fd-4419-84d0-dc957f3e8114"; // AO QUADRADO

  console.log("Testando ADMIN com AO QUADRADO:");
  try {
    const allowed = canReadIndustry(adminScope, industryId);
    console.log(`  canReadIndustry: ${allowed}`);
    assertIndustryAllowed(adminScope, industryId);
    console.log("  assertIndustryAllowed: OK");
  } catch (e: any) {
    console.log(`  FALHA ADMIN: ${e.message}`);
  }

  // Mock de escopo restrito (canViewAll: false, allowedIndustryIds: [...])
  const restrictedScope: any = {
    role: "CLIENTE",
    canViewAll: false,
    allowedIndustryIds: ["outro-id"],
    allowedUfs: ["SP"]
  };

  console.log("\nTestando RESTRICTED com AO QUADRADO (esperado 403):");
  try {
    const allowed = canReadIndustry(restrictedScope, industryId);
    console.log(`  canReadIndustry: ${allowed}`);
    assertIndustryAllowed(restrictedScope, industryId);
    console.log("  assertIndustryAllowed: OK (ERRO: deveria ter falhado)");
  } catch (e: any) {
    console.log(`  assertIndustryAllowed: OK (${e.message})`);
  }

  // Mock de escopo "Falso Positivo" (canViewAll: false, allowedIndustryIds: null)
  // Alguns casos podem ter null mesmo sem canViewAll se a regra falhar
  const nullScope: any = {
    role: "SUPERVISOR",
    canViewAll: false,
    allowedIndustryIds: null
  };

  console.log("\nTestando NULL SCOPE (allowedIndustryIds=null):");
  try {
    const allowed = canReadIndustry(nullScope, industryId);
    console.log(`  canReadIndustry: ${allowed}`);
    assertIndustryAllowed(nullScope, industryId);
    console.log("  assertIndustryAllowed: OK");
  } catch (e: any) {
    console.log(`  FALHA NULL SCOPE: ${e.message}`);
  }
}

verify().catch(console.error);
