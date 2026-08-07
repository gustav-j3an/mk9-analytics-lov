# 02. Banco de Dados e RLS

## Tabelas Principais
- `mk9_industries`: Cadastro de indústrias e flags de ciclo (ex: KING).
- `mk9_stores`: Cadastro de lojas com normalização de nomes para evitar duplicidade.
- `mk9_promoters`: Cadastro de promotores.
- `mk9_actual_visits`: Registro real das visitas executadas (origem: Checklist).
- `mk9_industry_store_frequency_versions`: Histórico versionado de metas contratadas.
- `mk9_checklist_imports`: Log de processamento e histórico de arquivos.
- `mk9_audit_logs`: Rastreabilidade de ações administrativas.

## Segurança (RLS)
- **Isolamento**: Toda query deve incluir filtro por `industry_id`.
- **RBAC**: Permissões baseadas na tabela `mk9_user_roles`.
- **Privilégios**: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;` é obrigatório para cada nova tabela.

## Normalização
- Nomes de lojas e indústrias são sempre salvos com uma versão normalizada (`name_normalized`) para facilitar buscas e evitar registros duplicados por erros de digitação (acentos, espaços, etc).
