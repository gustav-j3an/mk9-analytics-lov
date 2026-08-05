# MISSÃO 2 — CENTRO DE HOMOLOGAÇÃO OPERACIONAL (MK9 HEALTH CHECK)

O MK9 está entrando em fase de produção.

Quero criar um módulo chamado:

"Homologação"

ou

"Saúde do Sistema"

Objetivo:

Permitir que o ADMIN valide toda a integridade da operação antes de publicar novos dados.

==================================================
MENU
==================================================

Adicionar um novo módulo:

ADMINISTRAÇÃO

→ Homologação

Somente ADMIN.

==================================================
PAINEL
==================================================

Criar um painel de verificação com um botão:

[ Executar Verificação Completa ]

Ao clicar, executar todas as validações abaixo.

==================================================
1. CHECKLISTS
==================================================

Verificar:

✔ importações duplicadas

✔ competências duplicadas

✔ duas importações operacionais da mesma indústria

✔ importações inconsistentes

✔ importações sem visitas

✔ visitas sem importação

✔ importações revertidas ainda contabilizadas

==================================================
2. LOJAS
==================================================

Encontrar:

✔ lojas duplicadas

✔ lojas sem UF

✔ lojas sem cidade

✔ lojas sem frequência

✔ lojas sem indústria

✔ lojas sem roteiro

==================================================
3. INDÚSTRIAS
==================================================

Verificar:

✔ frequência inexistente

✔ frequência duplicada

✔ período operacional inválido

✔ indústria sem competência

✔ indústria sem checklist

==================================================
4. PROMOTORES
==================================================

Verificar:

✔ promotor sem roteiro

✔ roteiro sem promotor

✔ promotor sem supervisor

✔ promotor inativo com roteiro

✔ roteiro vazio

==================================================
5. ROTEIROS
==================================================

Verificar:

✔ visitas duplicadas

✔ visitas sem loja

✔ visitas sem indústria

✔ visitas fora da competência

✔ visitas fora da frequência

==================================================
6. DASHBOARD
==================================================

Comparar:

Contratadas

Realizadas

Pendentes

Extras

Os números devem ser iguais em:

Dashboard

Cockpit

Indústrias PDF

Auditoria

==================================================
7. PDF
==================================================

Gerar automaticamente um teste para:

✔ PDF da indústria

✔ PDF do promotor

✔ PDF de lojas não atendidas

Confirmar que nenhum lança erro.

==================================================
8. BANCO
==================================================

Encontrar:

✔ registros órfãos

✔ FKs quebradas

✔ referências inexistentes

✔ imports sem indústria

✔ visitas sem loja

==================================================
9. RESULTADO
==================================================

Mostrar um resumo:

Sistema

Status

Importações

Lojas

Indústrias

Promotores

Roteiros

Dashboard

PDF

Banco

Cada item deve ficar:

🟢 OK

🟡 Atenção

🔴 Erro

==================================================
10. RELATÓRIO
==================================================

Gerar um PDF chamado:

RELATÓRIO DE HOMOLOGAÇÃO MK9

Com:

data

hora

usuário

problemas encontrados

ações sugeridas

==================================================
11. BOTÃO
==================================================

Adicionar:

[ Corrigir automaticamente ]

Somente para problemas seguros:

✔ cache

✔ índices

✔ importações órfãs

✔ versões duplicadas

✔ status incorretos

Nunca apagar dados automaticamente.

==================================================
12. FINAL
==================================================

Executar:

build

typecheck

testes

Validar tudo no Preview.

Somente concluir quando todas as verificações estiverem funcionando.
