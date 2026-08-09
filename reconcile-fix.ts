import { reconcile } from "./src/lib/mk9-reconciliation/engine.server";
import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function runFix() {
  console.log("Iniciando re-reconciliação para COOPATOS Julho...");
  const result = await reconcile({
    industryId: '57376220-55fd-4419-84d0-dc957f3e8114',
    operationMonth: 7,
    operationYear: 2026,
    sourceImportId: '77e0512e-6b81-4fc2-b408-475d2864967d'
  });
  console.log("Reconciliação concluída:", JSON.stringify(result, null, 2));
}

runFix().catch(console.error);
