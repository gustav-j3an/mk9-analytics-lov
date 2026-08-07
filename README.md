# MK9 Analytics - Documentação Técnica

## Visão Geral
Sistema central de inteligência operacional para gestão de promotores, indústrias e lojas. Focado em auditoria, conciliação de visitas e relatórios automatizados.

## Stack Tecnológica
- **Frontend**: TanStack Start v1 (React 19 + Vite 7).
- **Backend**: TanStack Server Functions + Supabase (PostgreSQL + RLS).
- **Estilização**: Tailwind CSS v4 + Shadcn UI (Glassmorphism).
- **Testes**: Vitest.

## Estrutura de Pastas Principal
- `src/routes`: Roteamento baseado em arquivos (TanStack Router).
- `src/lib/mk9-auth`: Autenticação e RBAC.
- `src/lib/mk9-frequency`: Gestão de frequências versionadas.
- `src/lib/mk9-operations`: Núcleo de cálculo operacional compartilhado.
- `src/lib/mk9-quality`: Detectores de inconsistência e SLA.
- `src/lib/mk9-reports`: Motores de métricas e geração de PDF.
- `src/components`: Módulos de UI (Cockpit, Dashboard, Importador).

## Instalação e Execução
1. `bun install`
2. `bun run dev`
3. Testes: `bun run test`

---
*Documentação gerada em 2026 para novos desenvolvedores.*
