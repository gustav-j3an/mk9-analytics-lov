# Plano de Missão 0 — Auditoria do Portal do Promotor

Este plano detalha a auditoria técnica da arquitetura atual para preparar o sistema para o futuro Portal do Promotor, conforme solicitado. Nenhuma feature ou alteração de banco será implementada nesta etapa, apenas o mapeamento e diagnóstico.

## Atividades Realizadas

- [x] Mapeamento da stack tecnológica atual (React 19, TanStack Start, Supabase).
- [x] Auditoria do sistema de autenticação e normalização de papéis.
- [x] Verificação da existência do papel `PROMOTOR`.
- [x] Análise das tabelas de Promotores, Freelancers e Lojas em busca de vínculos e lacunas.
- [x] Mapeamento do fluxo de Roteiros Planejados e Visitas Realizadas.
- [x] Verificação de suporte a Storage, Geolocalização e PWA.
- [x] Identificação de riscos técnicos e lacunas de arquitetura.

## Detalhes Técnicos

- **Lacuna de Identidade:** A tabela `mk9_promoters` não possui `user_id`, impedindo o vínculo direto com o usuário logado.
- **Lacuna de Execução:** A tabela `mk9_actual_visits` não possui `promoter_id`, o que impede saber quem realizou a visita vinda do portal.
- **Geolocalização:** Não há campos de `latitude`/`longitude` nas tabelas `mk9_stores` ou `mk9_actual_visits`.
- **Mídia:** Necessidade de criar um bucket no Supabase Storage para evidências fotográficas.
- **Roles:** O papel `PROMOTOR` já está previsto no enum de banco e no código, mas sem uso operacional no portal mobile.

## Relatório de Entrega

O diagnóstico detalhado foi salvo em `mem://mk9/portal-audit-report.md` e indexado na memória do projeto.

---

A Missão 0 está concluída com a entrega do relatório de arquitetura. Nenhuma alteração funcional foi realizada.
