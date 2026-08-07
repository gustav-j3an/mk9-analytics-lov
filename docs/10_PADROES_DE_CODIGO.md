# 10. Padrões de Código

## 1. Server Functions
- Devem ser declaradas em arquivos `.functions.ts`.
- Devem usar `.validator()` com Zod.
- Devem usar `.middleware([requireSupabaseAuth])` para proteção.
- Lógica de banco complexa deve ser movida para ajudantes `.server.ts`.

## 2. Componentes UI
- Preferir Tailwind CSS v4 para estilização.
- Usar variáveis de tema (@theme) em vez de cores hardcoded.
- Componentes pesados devem ser divididos em sub-componentes menores.

## 3. Tratamento de Erros
- Nunca lançar erros técnicos crus para o usuário.
- Usar `sanitizeServerError` para limpar stack traces e SQL de respostas de API.
- Logs de erro no servidor devem ser descritivos para debug via Cloudwatch/Logs.
