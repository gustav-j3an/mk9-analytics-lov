# Plan: Missão 8A - Restaurar o Módulo de Roteiros Original

Restaurar a finalidade original do módulo "Roteiros" (Gestão da Rota-Base) sem remover a infraestrutura operacional (GPS, Evidências, Portal) introduzida na Missão 7.

## Processo de Auditoria e Diagnóstico
- Auditoria de `mk9_planned_routes` realizada.
- **Resultado:** 0 registros encontrados nas tabelas `mk9_planned_routes`, `mk9_promoters`, `mk9_stores`.
- **Causa da Regressão Visual:** A v3.9.0 transformou o módulo de Roteiros em "Command Center" (Dashboard operacional).
- **Diagnóstico:** A ausência de dados no sandbox é normal se não houver importação prévia nesta sessão. A Missão 8A foca em restaurar a UI de "Gestão de Rota-Base".

## Implementação

### 1. Sidebar e Navegação
- Renomear "Distribuição de Rotas" para "ROTEIROS" em `src/components/mk9-analytics-app.tsx`.
- Ajustar ícone e título na Sidebar.

### 2. Restauração do Módulo de Roteiros (`src/components/mk9-routes-module.tsx`)
- Remover lógica de "Command Center" (métricas de visitas, evidências, status de acesso).
- Restaurar agrupamento: **Promotor -> Dia da Semana -> Loja -> Indústrias**.
- Implementar visualização de cards por Promotor com resumo semanal.
- Garantir que a mesma loja seja mostrada uma única vez dentro do dia, listando suas indústrias abaixo.

### 3. Ações e CRUD
- Restaurar botão "[ + NOVO ITEM DE ROTEIRO ]" vinculando Promotor, Loja, Indústria, Dias e Vigência.
- Implementar botões "[ EDITAR ]" e "[ EXCLUIR ]" por vínculo de Indústria.
- Preservar funcionalidade de "[ TRANSFERÊNCIA DE ROTA ]".
- Preservar link para "[ VER ROTA ]" (Matriz Semanal/PDF).

### 4. Preservação da Infraestrutura
- Manter funções de backend que suportam o Portal do Promotor (`mk9GetPromoterOperationalRoute`).
- Não alterar as tabelas `mk9_visit_evidence`, `mk9_actual_visits`.

## Detalhes Técnicos
- Utilizar `mk9RoutesListVersioned` para a listagem principal.
- Reorganizar o componente `Mk9RoutesModule` para refletir a hierarquia de Roteiro-Base.
- Manter o suporte a vigência (`valid_from`/`valid_until`) existente no banco.
- Remover referências a status operacionais (PENDING/APPROVED) desta tela específica.

## Verificação
- Validar se a sidebar reflete o nome "ROTEIROS".
- Validar se o agrupamento por Dia -> Loja -> Indústria está correto.
- Testar a criação de um novo item de roteiro.
- Garantir que o Portal do Promotor continua funcional (consumindo `mk9_planned_routes`).
