// v3.7.3 — MISSÃO 2.1 — HOMOLOGAÇÃO REAL DE EVIDÊNCIAS
/*
MISSÃO 2.1 — HOMOLOGAÇÃO REAL DE EVIDÊNCIAS

A implementação da Missão 2 está concluída.

NÃO criar novas funcionalidades.
NÃO alterar interface sem encontrar um bug.
NÃO implementar GPS.
NÃO iniciar Missão 3.

Quero agora TESTAR a implementação existente.

========================================
1. STORAGE
========================================

Confirmar tecnicamente:

Bucket:
visit-evidence

Public:
FALSE

Verificar que não existe acesso público às imagens.

Confirmar que a aplicação NÃO utiliza getPublicUrl() para evidências.

Informar como a visualização privada é realizada.

========================================
2. TESTE DE UPLOAD
========================================

Executar o fluxo:

PROMOTOR
→ Minha Rota
→ Realizar Visita
→ selecionar/tirar foto
→ compressão
→ upload
→ mk9_visit_evidence

Confirmar:

- arquivo criado;
- photo_path correto;
- promoter_id correto;
- planned_route_id correto;
- store_id correto;
- industry_id correto;
- status PENDING.

========================================
3. VERIFICAR A COMPRESSÃO

Informar:

Imagem original:
- tamanho
- resolução

Imagem enviada:
- tamanho
- resolução
- formato

Confirmar que browser-image-compression está realmente sendo executado antes do upload.

========================================
4. SEGURANÇA ENTRE PROMOTORES

Simular:

PROMOTOR A
tentando enviar evidência usando
planned_route_id do PROMOTOR B.

Resultado obrigatório:

NEGADO

Testar também tentativa direta de upload no path:

promoters/{PROMOTOR_B_ID}/...

Resultado obrigatório:

NEGADO

========================================
5. TESTE CRÍTICO — ACTUAL VISITS

Antes do envio da foto:

consultar quantidade correspondente em:

mk9_actual_visits

Enviar uma evidência.

Consultar novamente.

Resultado obrigatório:

A quantidade NÃO pode aumentar.

Nesta etapa:

FOTO
→ PENDING

NÃO:

FOTO
→ REALIZADA

Mostrar evidência desse teste.

========================================
6. TESTAR ARQUIVO INVÁLIDO

Tentar:

PDF

Esperado:

NEGADO

Mostrar mensagem retornada.

========================================
7. TESTAR TAMANHO

Testar arquivo acima do limite configurado.

Esperado:

NEGADO ou comprimido somente dentro da regra definida.

Informar o limite real implementado.

========================================
8. TESTAR SUBSTITUIÇÃO

Criar evidência:

PENDING
→ Foto A

Depois substituir por:

Foto B

Confirmar:

- Foto B funciona;
- photo_path aponta para B;
- Foto A foi removida;
- somente uma evidência ativa permanece;
- nenhum arquivo órfão ficou no Storage.

========================================
9. TESTAR APPROVED

Temporariamente, em ambiente seguro de teste, usar uma evidência APPROVED.

Promotor tenta substituir a foto.

Esperado:

NEGADO.

Não implementar ainda o fluxo administrativo de aprovação.

Este teste é somente da regra de proteção existente.

========================================
10. SIGNED URL

Confirmar que:

photo_path
é armazenado no banco.

Signed URL:
é gerada temporariamente.

Signed URL NÃO fica armazenada em
mk9_visit_evidence.

========================================
11. RLS DA TABELA

Auditar:

SELECT
INSERT
UPDATE
DELETE

para PROMOTOR.

Confirmar especialmente que o Promotor NÃO consegue alterar:

status → APPROVED
status → REJECTED
reviewed_by
reviewed_at
promoter_id

Se existir alguma brecha, corrigir antes da homologação.

========================================
12. TESTE MOBILE

Testar viewport de celular.

Verificar:

Minha Rota
→ Realizar Visita
→ câmera/arquivo
→ preview
→ enviar
→ feedback de envio
→ status PENDENTE

Confirmar que:

- nenhum botão fica cortado;
- modal não ultrapassa viewport;
- foto não quebra layout;
- loading impede duplo envio.

========================================
13. TESTE DE ERRO DE REDE

Simular falha durante upload.

Confirmar que não fica:

registro no banco apontando para arquivo inexistente

nem:

arquivo órfão permanente sem registro.

Informar como a consistência é tratada.

========================================
RELATÓRIO FINAL
========================================

Entregar tabela:

TESTE | RESULTADO | EVIDÊNCIA

1. Bucket privado
2. Upload JPEG
3. Compressão
4. Rota de outro promotor
5. Namespace de outro promotor
6. Actual Visits não alterada
7. PDF bloqueado
8. Limite de tamanho
9. Substituição PENDING
10. APPROVED protegido
11. Signed URL
12. RLS
13. Mobile
14. Falha de rede

Classificar cada teste:

PASSOU
FALHOU
NÃO FOI POSSÍVEL TESTAR

Não declarar PASSOU sem teste ou evidência estrutural suficiente.

No final:

MISSÃO 2.1 HOMOLOGADA: SIM/NÃO

Se NÃO:
informar exatamente o que precisa ser corrigido.

NÃO iniciar Missão 3.
*/

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mk9LoginForm } from "@/components/mk9-login-form";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { Loader2, Activity } from "lucide-react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/client-only";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    title: "MK9 | Login",
    meta: [
      {
        name: "description",
        content: "Acesso ao MK9 Command Center.",
      },
      { property: "og:title", content: "MK9 | Login" },
      {
        property: "og:description",
        content: "Acesso ao MK9 Command Center.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function LoginPage() {
  const { session, loading, roles, signOut } = useMk9Session();
  const search = Route.useSearch() as { session_expired?: string };
  const navigate = useNavigate();

  useEffect(() => {
    if (search.session_expired === "true") {
      signOut();
      toast.info("Sua sessão expirou. Faça login novamente.");
      navigate({ to: "/", replace: true });
      return;
    }

    if (!loading && session) {
      if (roles.includes("PROMOTOR") && !roles.includes("ADMIN") && !roles.includes("SUPERVISOR")) {
        navigate({ to: "/mk9-portal", replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
  }, [session, loading, navigate, search.session_expired, signOut]);

  if (loading || session) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* Background Decorativo Sutil */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Activity className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground">
              MK9 <span className="text-primary">Analytics</span>
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
              Controle Operacional
            </p>
          </div>
        </div>

        <ClientOnly>
          <Mk9LoginForm />
        </ClientOnly>

        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-40">
          v3.7.2 — ARCHITECTURE AUDIT COMPLETE
        </p>
      </div>
    </div>
  );
}