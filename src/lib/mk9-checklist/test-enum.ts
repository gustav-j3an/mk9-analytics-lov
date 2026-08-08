import { updateImportStatus } from "./persistence.server";

// Teste rápido para validar que o banco aceita o novo valor do enum
async function test() {
  try {
    // Usamos um ID inexistente apenas para testar se o driver/banco aceita o valor no payload
    // sem disparar erro de 'invalid input value for enum' antes de chegar no 'no rows affected'
    await updateImportStatus('00000000-0000-0000-0000-000000000000', {
      status: 'INCONSISTENT'
    });
    console.log("Banco aceitou o valor 'INCONSISTENT' (Update enviado sem erro de enum)");
  } catch (e: any) {
    if (e.message.includes('invalid input value for enum')) {
      console.error("ERRO: Banco AINDA NÃO ACEITA 'INCONSISTENT'");
      process.exit(1);
    } else {
      console.log("Banco aceitou o valor do enum (Erro esperado de ID não encontrado: " + e.message + ")");
    }
  }
}

test();
