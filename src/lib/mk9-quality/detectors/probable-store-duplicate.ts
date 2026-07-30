/**
 * Detector MVP 1 — PROBABLE_STORE_DUPLICATE (CADASTRO / PERSISTED).
 *
 * Encontra o mesmo estabelecimento cadastrado duas vezes. A decisão é humana:
 * o detector NUNCA funde lojas — apenas aponta o par e sugere a ação.
 *
 * Toda a regra vive em `../rules/store-duplicates` (pura e testada).
 */
import { findProbableStoreDuplicates } from "../rules/store-duplicates";
import { navigationTarget } from "../navigation";
import { capDetections } from "../rules/cap";
import { loadScopedStores } from "./context.server";
import type { DetectedIssue, Mk9DataQualityDetector, Mk9QualityDetectorContext } from "../types";

export const ISSUE_TYPE = "PROBABLE_STORE_DUPLICATE";
const SUMMARY_TYPE = "PROBABLE_STORE_DUPLICATE_SUMMARY";

export const probableStoreDuplicateDetector: Mk9DataQualityDetector = {
  id: ISSUE_TYPE,
  category: "CADASTRO",
  mode: "PERSISTED",
  issueTypes: [ISSUE_TYPE, SUMMARY_TYPE],

  async execute(ctx: Mk9QualityDetectorContext): Promise<DetectedIssue[]> {
    const stores = await loadScopedStores(ctx.supabase, ctx.scope);
    if (stores.length < 2) return [];

    const pairs = findProbableStoreDuplicates(stores);

    const issues: DetectedIssue[] = pairs.map((pair) => ({
      category: "CADASTRO" as const,
      issueType: ISSUE_TYPE,
      severity: pair.severity,
      entityType: "STORE",
      entityId: pair.aId,
      peerEntityId: pair.bId,
      storeId: pair.aId,
      // Duplicidade de cadastro não pertence a uma competência: é permanente
      // até alguém resolver. Sem competência, não é auto-resolvida por mês.
      competence: null,
      title: "Possível loja duplicada no cadastro",
      description:
        `"${pair.aName}" e "${pair.bName}" parecem ser a mesma loja ` +
        `(${pair.uf ?? "UF não informada"}). Duplicidade divide visitas e distorce os números.`,
      evidence: {
        storeName: pair.aName,
        peerStoreName: pair.bName,
        chain: pair.chain,
        storeUf: pair.uf,
        matchRule: pair.rule,
        similarity: pair.score,
        navigationTarget: navigationTarget({
          module: "stores",
          storeId: pair.aId,
          peerStoreId: pair.bId,
        }),
      },
      suggestedAction:
        "Conferir os dois cadastros e, se forem a mesma loja, unificar mantendo o histórico.",
      source: "detector:probable-store-duplicate",
      fingerprintParts: { rule: "store-duplicate" },
      contextParts: { rule: pair.rule, similarity: pair.score },
    }));

    return capDetections(issues, (hidden, total) => ({
      category: "CADASTRO" as const,
      issueType: SUMMARY_TYPE,
      severity: "CRITICO" as const,
      entityType: "SYSTEM",
      competence: null,
      title: "Volume alto de possíveis lojas duplicadas",
      description:
        `Foram encontrados ${total} pares suspeitos de duplicidade; ${hidden} não foram ` +
        "listados individualmente para manter o painel utilizável.",
      evidence: { count: total, hidden, navigationTarget: navigationTarget({ module: "stores" }) },
      suggestedAction: "Executar uma revisão em lote do cadastro de lojas.",
      source: "detector:probable-store-duplicate",
      fingerprintParts: { rule: "store-duplicate-summary" },
      contextParts: { total },
    }));
  },
};
