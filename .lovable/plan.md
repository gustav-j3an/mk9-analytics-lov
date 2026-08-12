# Plano de Implementação: Central de Distribuição de Rotas (MK9 Command Center)

Transformar a Gestão de Roteiros em uma central operacional de alta performance para ADMIN e SUPERVISOR, unificando status de acesso, métricas de rota e ações rápidas.

## Ações Sugeridas
- **Unificação de Visão**: Substituir a listagem simples de roteiros por uma tabela mestre de promotores com indicadores de saúde da rota.
- **Status de Acesso & Convite**: Integrar o status de vínculo do Portal (`mk9_promoters.user_id`) e botões de convite WhatsApp diretamente na central.
- **Métricas Operacionais**: Exibir contagem de lojas únicas e visitas planejadas para a competência/referência selecionada.
- **Filtros Inteligentes**: Adicionar filtros por UF e Status (Sem Rota, Sem Acesso, Completo).
- **Ações Rápidas**: Atalhos para Editar Rota, Ver Rota (Preview Mobile), Enviar Acesso e Histórico.

## Detalhes Técnicos
- **Interface**: Refatoração do `Mk9RoutesModule` (`src/components/mk9-routes-module.tsx`) para o novo layout "Command Center".
- **Backend**: Utilizar a função `mk9GetPromoterAccessStatus` e `mk9PromoterRouteStats` para alimentar a tabela mestre.
- **Performance**: Manter a estratégia de `queryKey` versionada para garantir reatividade ao alternar a data de referência.
- **Componentes**: Reuso de `PromoterInviteDialog` e `PromoterStatusBadge` para consistência visual.

## Checklist de Homologação
- [ ] Visualização clara de quem possui/não possui rota na data selecionada.
- [ ] Indicador visual de acesso ao Portal (Vínculo de usuário).
- [ ] Ações de "Gerenciar Rota" e "Preview" funcionando corretamente.
- [ ] Filtro por UF e busca por nome filtrando a tabela mestre.
- [ ] Responsividade mantida para tablets e desktops.

