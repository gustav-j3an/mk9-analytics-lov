import { reconcile } from "./src/lib/mk9-reconciliation/engine.server";

async function runFix() {
  console.log("Iniciando re-reconciliação para COPRA Julho...");
  const result = await reconcile({
    industryId: '46c288fd-01c6-44eb-bada-581754ad8dfc',
    operationMonth: 7,
    operationYear: 2026,
    sourceImportId: '902ae653-8691-4d42-936f-5d33436f4243'
  });
  console.log("Reconciliação concluída:", JSON.stringify(result, null, 2));
}

runFix().catch(console.error);
