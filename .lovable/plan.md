# Missão 6D — Plano de Implementação

Objetivo: Permitir que ADMIN/SUPERVISOR gerencie o acesso e convite de Promotores de forma integrada, unindo cadastro, roteiro e comunicação via Portal.

## User Review Required

> [!IMPORTANT]
> A Missão 6D assume que o fluxo de criação de usuários e papéis já existe e será reutilizado. O envio via WhatsApp depende de um número de contato válido no cadastro do promotor.

## Proposed Changes

### 1. Interface de Gestão de Promotores
- Atualizar `src/components/mk9-promoters-module.tsx` para exibir badges de status de acesso (VINCULADO/NÃO VINCULADO) e de rota (X VISITAS/SEM ROTA).
- Adicionar no menu de ações do promotor as opções: "Gerenciar Rota", "Enviar Acesso" e "Visualizar como Promotor".

### 2. Cadastro e Vínculo de Acesso
- Modificar `src/components/mk9/promoter-admin-dialogs.tsx` para incluir a seção "ACESSO AO PORTAL".
- Implementar componente de seleção de usuário existente ou botão para criar novo usuário (reutilizando lógica do `Mk9UsersModule`).
- Garantir que o vínculo `auth.users.id` -> `mk9_promoters.user_id` seja salvo corretamente.

### 3. Gerenciamento e Preview de Rota
- O botão "Gerenciar Rota" redirecionará para `/dashboard/routes` (ou equivalente) já filtrado pelo promotor.
- Criar um novo diálogo/modal `PromoterRoutePreviewDialog` para visualizar a rota exatamente como o promotor verá no portal, sem precisar logar como ele.

### 4. Convite e WhatsApp
- Implementar `PromoterInviteDialog` com a mensagem pré-configurada (Portal URL, Email, Instruções PWA).
- Adicionar botões "Abrir WhatsApp" (usando `wa.me`) e "Copiar Mensagem".
- A mensagem incluirá um resumo da rota para o próximo dia útil, se disponível.

### 5. Backend e Segurança
- Implementar server function `mk9GetPromoterAccessStatus` para buscar rapidamente o status de vínculo e contagem de roteiros planejados.
- Garantir que apenas ADMIN/SUPERVISOR (dentro de seu escopo) possam realizar essas ações.

## Technical Details
- **Tabelas**: `mk9_promoters`, `mk9_planned_routes`, `auth.users`.
- **Componentes**: `PromoterDialog`, `Mk9PromotersModule`, `Mk9UsersModule`.
- **Comunicação**: `window.open` para WhatsApp Web/App.
- **Segurança**: RLS em `mk9_promoters` já protege o campo `user_id`.

## Relatório Final
A. Fluxo de criação/vínculo
B. Gerenciar rota
C. Preview da rota
D. Status de acesso
E. Status da rota
F. Mensagem gerada
G. WhatsApp
H. Copiar mensagem
I. Fluxo de primeiro acesso
J. Teste ponta a ponta
K. Segurança
L. Typecheck
M. Build
N. Arquivos alterados

MISSÃO 6D HOMOLOGADA: NÃO (Aguardando implementação)
