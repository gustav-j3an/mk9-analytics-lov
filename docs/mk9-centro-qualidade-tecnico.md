# Centro de Qualidade dos Dados — Documentação Técnica (Fase 2 homologada)

Última homologação: 30/07/2026 (Fase 2B.5).

## 1. Arquitetura

```text
detectores (src/lib/mk9-quality/detectors/*)
        │  DetectedIssue[]  (puro, sem estado)
        ▼
motor  (engine.server.ts)  → fingerprint SHA256 + context_hash
        │
        ├── modo REALTIME  → resultado em memória, nada é gravado
        └── modo PERSISTED → RPC mk9_quality_sync_detections (transacional)
                                 ▼
                     mk9_data_quality_issues  (+ events, + comments)
                                 ▼
     repository.server.ts → mk9-quality.functions.ts → mk9-quality-module.tsx
```

Regras invioláveis:
- o Centro **apenas lê** dados operacionais; nunca altera frequência, roteiro, visita ou importação;
- nada é apagado fisicamente: encerra-se vigência ou arquiva-se (`archived_at`);
- toda leitura passa pelo escopo do usuário (UF / indústria / lojas permitidas).

## 2. Tabelas (todas com RLS ativa e GRANTs explícitos)

| Tabela | Status | Papel |
| --- | --- | --- |
| `mk9_data_quality_issues` | ativo | ocorrência consolidada, uma por fingerprint ativo |
| `mk9_data_quality_issue_events` | ativo | histórico imutável (detecção, transições, atribuição, prazo) |
| `mk9_data_quality_issue_comments` | ativo | comentários INTERNAL / CLIENT, com edição e arquivamento |

Índices em produção: `mk9_dq_fingerprint_active_uidx` (unicidade do ativo), `mk9_dq_last_seen_idx`, `mk9_dq_overview_idx`, `mk9_dq_status_idx`, `mk9_dq_severity_idx`, `mk9_dq_category_idx`, `mk9_dq_industry_idx`, `mk9_dq_store_idx`, `mk9_dq_competence_idx`, `mk9_dq_assigned_idx`, `mk9_dq_due_idx`, `mk9_dq_source_type_idx`, `mk9_dq_events_issue_idx`, `mk9_dq_comment_issue_idx`.

## 3. RPCs

| Função | Tipo | Classificação |
| --- | --- | --- |
| `mk9_quality_sync_detections` | SECURITY DEFINER | ativo — sincroniza detecções e aplica o ciclo de vida |
| `mk9_quality_transition_issue_v2` | SECURITY DEFINER | ativo — transição com resolução estruturada |
| `mk9_quality_transition_issue` | SECURITY DEFINER | compatibilidade — mantida para chamadas antigas |
| `mk9_quality_assign_issue` | SECURITY DEFINER | ativo — atribuição com validação de escopo |
| `mk9_quality_set_planning` | SECURITY DEFINER | ativo — prioridade e prazo |
| `mk9_quality_reopen_issue` | SECURITY DEFINER | ativo — reabertura manual (motivo ≥ 10 caracteres) |
| `mk9_quality_add_comment` / `edit_comment` / `archive_comment` | SECURITY DEFINER | ativo |
| `mk9_quality_default_due_at` | STABLE | ativo — SLA em dias úteis (espelhada em `sla.ts`) |
| `mk9_quality_guard_status` | trigger | ativo — bloqueia status impossível |
| `mk9_quality_projection_divergence`, `mk9_quality_legacy_counts` | SECURITY DEFINER | ativo — apoio a detectores técnicos |
| `mk9_quality_check_version` | STABLE | ativo — checagem de compatibilidade |

## 4. Detectores (11 — nenhum órfão)

Cadastro: `PROBABLE_STORE_DUPLICATE`, `INCOMPLETE_STORE_WITH_EXECUTION`, `INDUSTRY_WITHOUT_PERIOD_CONFIG`.
Operação: `OPERATION_PAIR_INTEGRITY` (consolida frequência ausente, roteiro ausente e visita sem roteiro numa única ocorrência por indústria × loja).
Frequência: `FREQUENCY_WEEKLY_MONTHLY_INCONSISTENCY`, `FREQUENCY_OVERLAP_GUARD`, `PROJECTION_FREQUENCY_DIVERGENCE`.
Importação: `EXCEL_DATABASE_DIVERGENCE`, `CHECKLIST_IMPORT_WITHOUT_VALIDATION`, `PENDING_IMPORT_CONFLICT`.
Integridade: `LEGACY_OPERATIONAL_DATA`.

Volume é limitado por `rules/cap.ts`: o excedente vira **uma** ocorrência-resumo (`*_SUMMARY`), nunca uma enxurrada de alertas.

## 5. Ciclo de vida

`OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED`, mais `RESOLVED_AUTO` (parou de ser detectado), `IGNORED` e `REOPENED`.

- reaparecer depois de RESOLVED/RESOLVED_AUTO ⇒ sempre `REOPENED`;
- IGNORED só reabre quando o **contexto muda** (`context_hash`); mesmo contexto preserva a decisão e registra `SEEN_AGAIN`;
- motivo mínimo: ignorar 5 caracteres, resolver 3, reabrir 10;
- histórico nunca é apagado; comentários e responsável são preservados na reabertura.

## 6. SLA — **dias úteis** (sábado e domingo não contam)

| Severidade | Prazo padrão |
| --- | --- |
| BLOQUEANTE | mesmo dia |
| CRITICO | 1 dia útil |
| ATENCAO | 3 dias úteis |
| AVISO | 5 dias úteis |
| INFO | sem prazo obrigatório |

O prazo é o **fim** do dia útil alvo (23:59:59 UTC). Prioridade (LOW/NORMAL/HIGH/URGENT) é independente da severidade. Ordenação da fila: atraso → prioridade → severidade → recência. Ocorrência encerrada nunca é contada como vencida.

## 7. Permissões

| Papel | Ler | Assumir/atribuir | Resolver | Ignorar | Forçar resolução |
| --- | --- | --- | --- | --- | --- |
| ADMIN | tudo | sim | sim | sim | sim |
| GESTOR | escopo | sim | sim | sim | não |
| AUDITOR | escopo | não | sim | **não** | não |
| SUPERVISOR | escopo | assume para si | sim | **não** | não |
| CLIENTE / PROMOTOR | escopo, leitura | não | não | não | não |

Atribuição só aceita usuário **dentro do escopo** da ocorrência (`assignee-scope.server.ts`). Toda RPC revalida escopo no servidor — ID manipulado não amplia acesso.

## 8. Comentários

Dois níveis: `INTERNAL` (equipe) e `CLIENT` (visível ao cliente). `comments.ts` higieniza PII e conteúdo técnico antes de expor. CLIENTE **nunca** recebe comentário INTERNAL nem evidência técnica (`evidenceForClient` mantém só nome da loja, sintomas e destino de navegação).

## 9. Deep-links

`navigation.ts` gera destinos para lojas, roteiro, frequência, auditoria, importação e conciliação, descartando campos vazios. O módulo de destino revalida escopo — link com ID de fora do escopo retorna vazio/erro controlado, não dado alheio.

## 10. Cache

TanStack Query por chave contendo usuário + filtros + competência; invalidação após qualquer ação de status, atribuição, prazo ou comentário. Não há cache compartilhado entre usuários.
