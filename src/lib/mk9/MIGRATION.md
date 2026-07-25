# Migração da lógica MK9 para Next.js + Prisma + PostgreSQL

Este documento descreve como transportar o **núcleo de importação MK9** deste
projeto (TanStack Start + Lovable Cloud/Supabase) para o seu projeto principal
em **Next.js + Prisma + PostgreSQL** com o mínimo de reescrita.

A arquitetura foi propositalmente organizada em camadas puras. Só a última
camada (persistência) precisa ser reimplementada.

---

## 1. Camadas e o que muda

| Camada | Arquivo | Depende de | Portável? |
|---|---|---|---|
| **Tipos de domínio** | `src/lib/mk9/types.ts` | — | ✅ 1:1 |
| **Normalização** | `src/lib/mk9/normalization.ts` | — | ✅ 1:1 |
| **Regras de negócio** | `src/lib/mk9/business/dates.ts` | — | ✅ 1:1 |
| **Parser XLSX** | `src/lib/mk9/parser.ts` | `xlsx` (SheetJS) | ✅ 1:1 |
| **Resolução** | `src/lib/mk9/resolution.ts` | tipos + normalização | ✅ 1:1 |
| **Sincronização (diff)** | `src/lib/mk9/sync.ts` | tudo acima | ✅ 1:1 |
| **Port do repositório** | `src/lib/mk9/repository.ts` | tipos | ✅ 1:1 (é uma interface) |
| **Orquestrador** | `src/lib/mk9/orchestrator.server.ts` | port | ✅ 1:1 |
| **Adapter de persistência** | `src/lib/mk9/persistence.server.ts` | Supabase | ❌ trocar por Prisma |
| **RPC / server functions** | `src/lib/mk9-import.functions.ts` | TanStack Start | 🔁 trocar por Next.js Route Handlers |
| **UI** | `src/components/mk9-import-module.tsx` | React | 🔁 mover para Next.js App Router (mesmo React) |

**Regra de ouro**: as 7 primeiras linhas da tabela (tudo até o orquestrador) são
**código puro** e devem ser copiadas para o Next.js sem alteração. Só troca:

- `persistence.server.ts` → `persistence.prisma.ts` (nova implementação de `Mk9Repository`)
- `mk9-import.functions.ts` → `app/api/mk9/import/preview/route.ts` + `.../commit/route.ts`

---

## 2. Schema Prisma equivalente

O schema aplicado no Lovable Cloud (ver a migração inicial no chat) tem
correspondência direta em Prisma. Cole em `prisma/schema.prisma`:

```prisma
enum Mk9IndustryStatus {
  DENTRO_DA_META  @map("DENTRO DA META")
  ACIMA_DA_META   @map("ACIMA DA META")
  ABAIXO_DA_META  @map("ABAIXO DA META")
  SEM_META        @map("SEM META")
  OK
}

enum Mk9VisitStatus { planned completed cancelled skipped }
enum Mk9SyncMode { full add_only registry_only routes_only }
enum Mk9ImportStatus { pending previewing confirmed committing done failed cancelled }

model Mk9Industry {
  id                          String  @id @default(uuid())
  name                        String
  nameNormalized              String  @unique @map("name_normalized")
  monthlyContractedFrequency  Int?    @map("monthly_contracted_frequency")
  monthlyEstimatedFrequency   Int?    @map("monthly_estimated_frequency")
  frequencyDifference         Int?    @map("frequency_difference")
  frequencyStatus             Mk9IndustryStatus? @map("frequency_status")
  weeksCount                  Int?    @map("weeks_count")
  lastImportId                String? @map("last_import_id")
  createdAt                   DateTime @default(now()) @map("created_at")
  updatedAt                   DateTime @updatedAt @map("updated_at")
  routes                      Mk9PlannedRoute[]
  visits                      Mk9PlannedVisit[]
  @@map("mk9_industries")
}

model Mk9Store {
  id             String  @id @default(uuid())
  chain          String?
  name           String
  nameNormalized String  @map("name_normalized")
  uf             String?
  lastImportId   String? @map("last_import_id")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  routes         Mk9PlannedRoute[]
  visits         Mk9PlannedVisit[]
  @@unique([nameNormalized, uf])
  @@map("mk9_stores")
}

model Mk9Promoter {
  id                 String  @id @default(uuid())
  externalId         String? @unique @map("external_id")
  name               String
  nameNormalized     String  @map("name_normalized")
  city               String?
  contact            String?
  contactNormalized  String? @map("contact_normalized")
  notes              String?
  lastImportId       String? @map("last_import_id")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")
  routes             Mk9PlannedRoute[]
  visits             Mk9PlannedVisit[]
  @@index([nameNormalized])
  @@index([contactNormalized])
  @@map("mk9_promoters")
}

model Mk9PlannedRoute {
  id              String @id @default(uuid())
  promoterId      String @map("promoter_id")
  storeId         String @map("store_id")
  industryId      String @map("industry_id")
  weekday         Int    @db.SmallInt
  operationMonth  Int    @map("operation_month") @db.SmallInt
  operationYear   Int    @map("operation_year")  @db.SmallInt
  sourceSheet     String? @map("source_sheet")
  lastImportId    String? @map("last_import_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  promoter        Mk9Promoter @relation(fields: [promoterId], references: [id], onDelete: Cascade)
  store           Mk9Store    @relation(fields: [storeId],    references: [id], onDelete: Cascade)
  industry        Mk9Industry @relation(fields: [industryId], references: [id], onDelete: Cascade)
  visits          Mk9PlannedVisit[]
  @@unique([promoterId, storeId, industryId, weekday, operationMonth, operationYear])
  @@index([operationYear, operationMonth])
  @@map("mk9_planned_routes")
}

model Mk9PlannedVisit {
  id            String @id @default(uuid())
  promoterId    String @map("promoter_id")
  storeId       String @map("store_id")
  industryId    String @map("industry_id")
  routeId       String? @map("route_id")
  scheduledDate DateTime @map("scheduled_date") @db.Date
  status        Mk9VisitStatus @default(planned)
  completedAt   DateTime? @map("completed_at")
  notes         String?
  sourceSheet   String? @map("source_sheet")
  lastImportId  String? @map("last_import_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  promoter      Mk9Promoter @relation(fields: [promoterId], references: [id], onDelete: Cascade)
  store         Mk9Store    @relation(fields: [storeId],    references: [id], onDelete: Cascade)
  industry      Mk9Industry @relation(fields: [industryId], references: [id], onDelete: Cascade)
  route         Mk9PlannedRoute? @relation(fields: [routeId], references: [id], onDelete: SetNull)
  @@unique([promoterId, storeId, industryId, scheduledDate])
  @@index([scheduledDate])
  @@index([status])
  @@map("mk9_planned_visits")
}

model Mk9Import {
  id              String @id @default(uuid())
  filename        String
  fileHash        String? @map("file_hash")
  operationMonth  Int @map("operation_month") @db.SmallInt
  operationYear   Int @map("operation_year")  @db.SmallInt
  syncMode        Mk9SyncMode @default(full) @map("sync_mode")
  status          Mk9ImportStatus @default(pending)
  sheetsAnalyzed  Json @default("[]") @map("sheets_analyzed")
  counters        Json @default("{}")
  preview         Json?
  errorMessage    String? @map("error_message")
  userId          String? @map("user_id")
  startedAt       DateTime @default(now()) @map("started_at")
  finishedAt      DateTime? @map("finished_at")
  durationMs      Int? @map("duration_ms")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  items           Mk9ImportItem[]
  @@index([status])
  @@index([operationYear, operationMonth])
  @@map("mk9_imports")
}

model Mk9ImportItem {
  id         String @id @default(uuid())
  importId   String @map("import_id")
  sheet      String
  excelRow   Int? @map("excel_row")
  entityType String @map("entity_type")
  action     String
  status     String @default("planned")
  payload    Json @default("{}")
  resolvedIds Json @default("{}") @map("resolved_ids")
  warnings   Json @default("[]")
  createdAt  DateTime @default(now()) @map("created_at")
  import     Mk9Import @relation(fields: [importId], references: [id], onDelete: Cascade)
  @@index([importId])
  @@index([action])
  @@map("mk9_import_items")
}
```

Depois:

```bash
npx prisma migrate dev -n mk9_master_import
npx prisma generate
```

---

## 3. Adapter Prisma do `Mk9Repository`

Crie `src/lib/mk9/persistence.prisma.ts` no seu projeto Next.js. A interface
`Mk9Repository` (mesma que você copiou de `repository.ts`) já define o
contrato — basta implementá-la:

```ts
import { prisma } from "@/lib/prisma";
import type { Mk9Repository } from "./repository";

export function createPrismaRepository(): Mk9Repository {
  return {
    async listIndustries() {
      const rows = await prisma.mk9Industry.findMany();
      return rows.map((r) => ({
        id: r.id, name: r.name, nameNormalized: r.nameNormalized,
        monthlyContractedFrequency: r.monthlyContractedFrequency,
        monthlyEstimatedFrequency: r.monthlyEstimatedFrequency,
        frequencyDifference: r.frequencyDifference,
        frequencyStatus: r.frequencyStatus as any,
        weeksCount: r.weeksCount,
      }));
    },
    async upsertIndustries(records, importId) {
      return prisma.$transaction(records.map((r) =>
        prisma.mk9Industry.upsert({
          where: { nameNormalized: r.nameNormalized },
          create: { ...toDbIndustry(r), lastImportId: importId },
          update: { ...toDbIndustry(r), lastImportId: importId },
        }),
      )).then((rows) => rows.map(fromDbIndustry));
    },
    // ... demais métodos seguem o mesmo padrão (upsert por chave lógica única).
  };
}
```

As chaves únicas do schema garantem idempotência: reenviar o mesmo arquivo
não cria duplicidades.

---

## 4. RPC → Next.js Route Handlers

Troque `src/lib/mk9-import.functions.ts` por dois handlers:

```ts
// app/api/mk9/import/preview/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePreview } from "@/lib/mk9/orchestrator.server";
import { createPrismaRepository } from "@/lib/mk9/persistence.prisma";

export const runtime = "nodejs"; // xlsx precisa de Buffer

const schema = z.object({
  filename: z.string(), base64: z.string(),
  operationMonth: z.number().int().min(1).max(12),
  operationYear: z.number().int(),
  syncMode: z.enum(["full","add_only","registry_only","routes_only"]),
});

export async function POST(req: Request) {
  const parsed = schema.parse(await req.json());
  const buffer = Buffer.from(parsed.base64, "base64");
  const repo = createPrismaRepository();
  const res = await generatePreview(repo, {
    buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    filename: parsed.filename,
    operationMonth: parsed.operationMonth,
    operationYear: parsed.operationYear,
    syncMode: parsed.syncMode,
  });
  return NextResponse.json(res);
}
```

E outra rota `commit` idêntica chamando `commitImport`. A UI muda apenas o
`fetch` para `/api/mk9/import/preview` — nenhuma outra alteração.

---

## 5. Performance e transações

O commit já faz batching de 500 linhas nas escritas de `import_items`. Em
Prisma, envolva o commit em `prisma.$transaction(async (tx) => { ... })` e
substitua o adapter para usar `tx` em vez de `prisma` — assim toda a
importação vira uma transação única com rollback automático em caso de falha.

O contrato do `Mk9Repository` não muda; apenas a implementação Prisma
tem um construtor que aceita `tx` como argumento opcional.

---

## 6. Checklist de portabilidade

- [ ] Copiar `src/lib/mk9/*.ts` **exceto** `persistence.server.ts` e
      `orchestrator.server.ts` (que também vai, mas com `import.server`
      removido — não há Cloudflare Worker aqui).
- [ ] Instalar `xlsx` (`npm i xlsx`).
- [ ] Adicionar o bloco Prisma acima e rodar `prisma migrate dev`.
- [ ] Implementar `createPrismaRepository()`.
- [ ] Criar as rotas Next.js `preview` e `commit`.
- [ ] Copiar `mk9-import-module.tsx` e trocar `useServerFn` por `fetch`.
- [ ] Rodar `npx tsc --noEmit` e um teste real com a planilha do mês.

---

## 7. O que fica no Lovable (temporariamente)

Enquanto o projeto principal não estiver pronto:

- Este projeto no Lovable já é funcional — a planilha alimenta o banco do
  Lovable Cloud, gera preview, faz commit idempotente e mantém histórico.
- Todas as camadas puras aqui já são as **mesmas** que rodarão no Next.js —
  então corrigir bug/regra aqui equivale a corrigir lá.
