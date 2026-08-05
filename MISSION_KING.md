# MISSÃO 1 — HOMOLOGAÇÃO DA KING

Esta missão é exclusiva da indústria KING.

Não alterar nenhuma outra indústria.

Não modificar Dashboard, Cockpit, Roteiros, PDF de outras indústrias, Limpeza Manual ou Importador geral.

==================================================
OBJETIVO
==================================================

Fazer com que o checklist da KING funcione corretamente.

Fluxo esperado:

1. importar checklist;
2. gerar prévia;
3. persistir visitas;
4. reconciliar lojas;
5. marcar importação vigente;
6. contabilizar visitas realizadas;
7. atualizar Dashboard;
8. atualizar Indústrias (PDF).

==================================================
AUDITORIA
==================================================

Executar uma auditoria completa da última importação da KING.

Responder internamente:

- import_id;
- competência;
- período operacional;
- visitas lidas;
- visitas persistidas;
- visitas descartadas;
- motivo dos descartes;
- lojas conciliadas;
- lojas não conciliadas;
- motivo do status "Inconsistente".

==================================================
VALIDAÇÃO
==================================================

Escolher 5 linhas reais do checklist.

Rastrear:

Excel

↓

Loja encontrada

↓

Store ID

↓

Visit ID

↓

Persistência

↓

Dashboard

↓

Indústrias PDF

Encontrar exatamente onde a visita deixa de aparecer.

==================================================
CORREÇÃO
==================================================

Corrigir somente a etapa responsável.

Não alterar o restante do pipeline.

==================================================
VALIDAÇÃO FINAL
==================================================

Após a correção:

✔ importar novamente o checklist da KING;

✔ verificar o Dashboard;

✔ verificar Indústrias (PDF);

✔ verificar Histórico;

✔ confirmar que todas utilizam exatamente os mesmos números.

==================================================
IMPORTANTE
==================================================

Não alterar nenhuma funcionalidade de outras indústrias.

Se durante a auditoria for identificado qualquer problema fora da KING, apenas registrar para uma missão futura.

Não corrigir agora.

==================================================
ENTREGA
==================================================

Entregar:

- causa raiz;
- arquivo alterado;
- função alterada;
- motivo da inconsistência;
- quantidade de visitas reconciliadas;
- quantidade de visitas realizadas contabilizadas;
- testes;
- build;
- typecheck.

Finalizar somente quando o checklist da KING estiver contabilizando corretamente as visitas realizadas em todos os módulos.