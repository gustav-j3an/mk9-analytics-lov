import { mk9ListIndustries } from "./src/lib/mk9-data.functions";
import { resolveMk9AccessScope } from "./src/lib/mk9-auth/access-scope.server";
import { requireMk9Role } from "./src/lib/mk9-auth/require-role.server";

async function test() {
  console.log("Starting Server Function Test...");
  const adminId = "5355bcd6-1977-43ce-b71b-5452ce15d088";
  
  // Simular contexto de auth
  const ctx = {
    userId: adminId,
    roles: ["ADMIN"] as any,
    claims: {},
    devBypass: false
  };

  try {
    const scope = await resolveMk9AccessScope(ctx as any);
    console.log("Role resolvida:", scope.role);
    console.log("canViewAll:", scope.canViewAll);
    console.log("allowedIndustryIds:", scope.allowedIndustryIds);

    // Como mk9ListIndustries é uma server function do TanStack, 
    // precisamos chamá-la de forma que ela execute o handler.
    // O TanStack Start injeta o contexto no handler.
    // Para teste rápido, vamos ler o arquivo e extrair a lógica ou usar o supabaseAdmin diretamente.
    
    const { supabaseAdmin } = await import("./src/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("mk9_industries")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching industries:", error);
    } else {
      console.log("Quantidade retornada:", data?.length);
      console.log("Primeiros 10 nomes:", data?.slice(0, 10).map(i => i.name).join(", "));
    }
  } catch (e) {
    console.error("Test failed:", e);
  }
}

test();
