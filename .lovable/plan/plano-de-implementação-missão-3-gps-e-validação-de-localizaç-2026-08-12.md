# Plano de Implementação — MISSÃO 3 — GPS e Validação de Localização

Este plano detalha a implementação da captura de GPS no Portal do Promotor, o cálculo de distância em relação às coordenadas da loja e o registro desses dados como evidência operacional.

## Alterações Sugeridas

### 1. Banco de Dados (Migrations)
- **Tabela `mk9_stores`**: Adicionar campos `latitude` e `longitude` (DOUBLE PRECISION) para armazenar as coordenadas oficiais das lojas.
- **Tabela `mk9_visit_evidence`**: Adicionar campos para auditoria de localização:
    - `latitude`, `longitude` (capturados no celular)
    - `accuracy_meters` (precisão do GPS)
    - `distance_from_store_meters` (calculado no servidor)
    - `location_status` (MATCH, REVIEW, OUTSIDE, UNAVAILABLE)
    - `location_captured_at` (timestamp da captura)

### 2. Backend (Server Functions)
- **Cálculo de Distância**: Implementar a fórmula de Haversine em uma função utilitária no servidor para calcular a distância real entre a captura e a loja.
- **Refatoração `uploadVisitEvidence`**: 
    - Receber `latitude`, `longitude` e `accuracy` do frontend.
    - Buscar coordenadas da loja vinculada à rota.
    - Calcular distância e definir o `location_status` (MATCH < 100m, REVIEW < 250m, OUTSIDE > 250m).
    - Regra de Precisão: Se a precisão (`accuracy`) for muito baixa (ex: > 100m), forçar status `REVIEW` mesmo se a distância parecer pequena.
- **Gestão de Lojas**: Atualizar `mk9CreateStore` e `mk9UpdateStore` para suportar os novos campos de coordenadas.

### 3. Frontend (Portal e Administrativo)
- **Captura GPS (Portal)**: Usar a Geolocation API (`navigator.geolocation`) com `enableHighAccuracy: true` ao clicar em "Realizar Visita".
- **Feedback Visual**: Mostrar ao promotor a distância calculada e o status da localização antes/durante o envio da foto.
- **Cadastro de Lojas (Admin)**: Adicionar seção "LOCALIZAÇÃO" no diálogo de edição de lojas com campos de Latitude e Longitude.

## Detalhes Técnicos

### Schema SQL
```sql
-- Adiciona coordenadas às lojas
ALTER TABLE public.mk9_stores 
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

-- Adiciona dados de GPS às evidências
ALTER TABLE public.mk9_visit_evidence
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN accuracy_meters DOUBLE PRECISION,
ADD COLUMN distance_from_store_meters DOUBLE PRECISION,
ADD COLUMN location_status TEXT CHECK (location_status IN ('MATCH', 'REVIEW', 'OUTSIDE', 'UNAVAILABLE')),
ADD COLUMN location_captured_at TIMESTAMPTZ;
```

### Regras de Classificação
- **MATCH**: Distância <= 100m E precisão <= 100m.
- **REVIEW**: 100m < Distância <= 250m OU precisão > 100m.
- **OUTSIDE**: Distância > 250m.
- **UNAVAILABLE**: Loja sem coordenadas cadastradas.

---
**Próximo Passo**: Aguardar aprovação para executar as migrations e iniciar a implementação do motor de GPS.
