# Missão 2 — Evidências de Visita e Storage

## Objetivo
Implementar o fluxo técnico de upload de fotos de visita (evidências) no Portal do Promotor, com armazenamento privado e registro transacional.

## Detalhes Técnicos

### 1. Banco de Dados (Supabase)
- **Tabela:** `mk9_visit_evidence`
  - `id` (uuid, PK)
  - `promoter_id` (uuid, FK mk9_promoters)
  - `planned_route_id` (uuid, FK mk9_planned_routes)
  - `store_id` (uuid, FK mk9_stores)
  - `industry_id` (uuid, FK mk9_industries)
  - `photo_path` (text)
  - `status` (enum: PENDING, APPROVED, REJECTED)
  - `captured_at` (timestamptz)
  - `created_at` (timestamptz)
  - `reviewed_by` (uuid)
  - `reviewed_at` (timestamptz)
  - `rejection_reason` (text)
- **RLS:**
  - PROMOTOR: CRUD somente das próprias evidências.
  - ADMIN/SUPERVISOR: Leitura completa.

### 2. Storage
- **Bucket:** `visit-evidence` (PRIVATE).
- **Estrutura de Path:** `promoters/{promoterId}/{yyyy}/{mm}/{evidenceId}.jpg`.
- **Policies:**
  - Upload restrito ao namespace do próprio promotor.

### 3. Frontend (Portal do Promotor)
- **Componente:** Extensão do card de visita no `Mk9PortalDashboard`.
- **Fluxo:** Botão "Realizar Visita" -> Câmera/Galeria -> Preview -> Upload.
- **Compressão:** Client-side via `browser-image-compression` ou similar (max 1600px).
- **Feedback:** Estados de loading e sucesso/erro.

### 4. Lógica de Servidor (Server Functions)
- Validação rigorosa de identidade via `getCurrentPromoter()`.
- Verificação de que a `planned_route_id` pertence ao promotor logado antes de aceitar o upload/registro.

## Critérios de Aceite
1. Foto enviada com sucesso para o bucket privado.
2. Registro criado em `mk9_visit_evidence` com status `PENDING`.
3. Isolamento total entre promotores (RLS e Storage Policies).
4. Substituição permitida apenas para status `PENDING`.
5. `mk9_actual_visits` permanece inalterada nesta missão.
