# Sincronização Automática Google Drive via n8n

O MK9 Analytics permite a sincronização automática de checklists depositados em pastas do Google Drive. Este fluxo utiliza uma arquitetura M2M (Machine-to-Machine) autenticada.

## 1. Arquitetura do Fluxo

1. **Google Drive**: Arquivo `.xlsx` é adicionado ou modificado.
2. **n8n**: Detecta a mudança via node "Google Drive Trigger" ou polling.
3. **Processamento n8n**:
   - Baixa o conteúdo do arquivo.
   - Gera um hash (opcional, mas recomendado).
   - Envia um `POST` multipart/form-data para o MK9.
4. **MK9 (API)**: 
   - Valida o `MK9_SYNC_SECRET`.
   - Registra a detecção na tabela `mk9_checklist_sync_files`.
   - O motor de sincronização identifica Indústria e Competência pelo nome do arquivo.
   - Executa o preview e, se não houver alertas bloqueantes, realiza o commit (substituição atômica).

## 2. Configuração do n8n

### Endpoint
`POST https://project--{id}.lovable.app/api/public/sync/checklists`

### Headers
`Authorization: Bearer <SEU_TOKEN_CONFIGURADO_NO_LOVABLE_CLOUD>`
`Content-Type: multipart/form-data`

### Body (multipart/form-data)
- `file`: O arquivo binário do Excel.
- `externalFileId`: O ID único do arquivo no Google Drive.
- `fileHash`: (Opcional) SHA-256 do arquivo para evitar reprocessamento idêntico.
- `modifiedTime`: (Opcional) Data de modificação do arquivo no Drive.

## 3. Regras de Identificação Automática

O motor tenta extrair as informações do nome do arquivo (ex: `Checklist_CocaCola_Julho_2026.xlsx`):
- **Indústria**: Busca parcial ignorando acentos/maiusculas no campo `name_normalized`.
- **Competência**: Busca por nomes de meses em português e anos `20XX`.

## 4. Critérios de Auto-Importação

O sistema importa automaticamente APENAS se:
1. Nenhuma loja nova for detectada (evita cadastros fantasmas).
2. Nenhuma data for considerada inválida.
3. Não houver duplicidade de nomes de lojas.

Caso contrário, o arquivo fica em estado `NEEDS_REVIEW` no módulo **Sync Drive** para intervenção manual.

## 5. Segurança

- **Segredo**: O segredo deve ser definido na variável de ambiente `MK9_SYNC_SECRET`.
- **Auditoria**: Toda sincronização gera um registro com logs de impacto (visitas criadas, fotos vinculadas, versões anteriores arquivadas).
