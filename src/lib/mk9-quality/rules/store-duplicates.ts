/**
 * MK9 — Fase 2B.2: regra PURA de duplicidade provável de loja.
 *
 * Objetivo: encontrar o MESMO estabelecimento cadastrado duas vezes, sem
 * transformar filiais legítimas em falso positivo.
 *
 * DEFESAS CONTRA FALSO POSITIVO (todas obrigatórias)
 *  1. só compara lojas da MESMA UF (UF diferente = estabelecimento diferente);
 *  2. só compara lojas da MESMA rede normalizada (ou ambas sem rede);
 *  3. números presentes no nome precisam ser IGUAIS — "LOJA 1" nunca é
 *     duplicata de "LOJA 2", por mais parecidos que os nomes sejam;
 *  4. palavras de filial explícita divergentes (NORTE/SUL/LESTE/OESTE/I/II...)
 *     bloqueiam o par;
 *  5. o par só é reportado acima de um limiar alto de similaridade.
 *
 * Sem I/O: recebe a lista de lojas já carregada e devolve pares candidatos.
 */
import { diceCoefficient } from "@/lib/mk9-checklist/similarity";
import {
  normalizeStoreName,
  normalizeText,
  storeCompactKey,
  storeTokenSetKey,
} from "@/lib/mk9/normalization";

export interface DuplicateCandidateStore {
  id: string;
  name: string;
  chain: string | null;
  uf: string | null;
}

export type DuplicateRule =
  | "EXACT_NORMALIZED"
  | "SAME_TOKENS"
  | "COMPACT_MATCH"
  | "HIGH_SIMILARITY";

export interface StoreDuplicatePair {
  /** ids ordenados: o par A↔B é sempre o mesmo problema que B↔A */
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  chain: string | null;
  uf: string | null;
  rule: DuplicateRule;
  /** 0..1, arredondado em 2 casas para manter o contexto estável */
  score: number;
  severity: "CRITICO" | "ATENCAO";
}

/** Limiar conservador: abaixo disso o risco de filial legítima é alto. */
export const DUPLICATE_THRESHOLD = 0.92;

/** Marcadores de filial: se aparecem em apenas um dos nomes, não é duplicata. */
const BRANCH_MARKERS = new Set([
  "norte",
  "sul",
  "leste",
  "oeste",
  "centro",
  "central",
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "a",
  "b",
  "c",
  "shopping",
  "express",
  "atacado",
  "varejo",
  "matriz",
  "filial",
]);

function digitsOf(normalized: string): string {
  const found = normalized.match(/\d+/g) ?? [];
  return Array.from(new Set(found.map((d) => String(Number(d)))))
    .sort()
    .join(",");
}

function branchMarkersOf(normalized: string): string {
  const tokens = normalized.split(/\s+/).filter((t) => BRANCH_MARKERS.has(t));
  return Array.from(new Set(tokens)).sort().join(",");
}

/**
 * Bloco = UF. A rede NÃO entra na chave porque, na base real, `chain` está
 * ausente em boa parte dos cadastros criados por importação — bloquear por
 * rede esconderia justamente as duplicatas mais comuns (uma com rede, outra
 * sem). A divergência de rede é tratada como defesa dentro do par.
 */
function blockKey(store: DuplicateCandidateStore): string {
  return (store.uf ?? "").toUpperCase() || "-";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Encontra pares candidatos. `maxPairs` protege contra explosão de volume:
 * os pares de maior score vêm primeiro.
 */
export function findProbableStoreDuplicates(
  stores: DuplicateCandidateStore[],
  options: { threshold?: number; maxPairs?: number } = {},
): StoreDuplicatePair[] {
  const threshold = options.threshold ?? DUPLICATE_THRESHOLD;
  const maxPairs = options.maxPairs ?? 200;

  const blocks = new Map<string, DuplicateCandidateStore[]>();
  for (const store of stores) {
    if (!store?.id || !store.name) continue;
    // Sem UF não há como afirmar que é o mesmo estabelecimento: fica para o
    // detector de cadastro incompleto, não para o de duplicidade.
    if (!store.uf) continue;
    const key = blockKey(store);
    const list = blocks.get(key) ?? [];
    list.push(store);
    blocks.set(key, list);
  }

  const pairs: StoreDuplicatePair[] = [];

  for (const list of blocks.values()) {
    if (list.length < 2) continue;

    const prepared = list.map((store) => {
      const normalized = normalizeStoreName(store.name);
      return {
        store,
        normalized,
        chain: normalizeText(store.chain),
        compact: storeCompactKey(normalized),
        tokens: storeTokenSetKey(normalized),
        digits: digitsOf(normalized),
        markers: branchMarkersOf(normalized),
      };
    });

    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        const a = prepared[i];
        const b = prepared[j];

        // Defesa 2: redes informadas e diferentes ⇒ estabelecimentos distintos.
        if (a.chain && b.chain && a.chain !== b.chain) continue;
        // Defesa 3: numeração de filial diferente ⇒ nunca é duplicata.
        if (a.digits !== b.digits) continue;
        // Defesa 4: marcador de filial presente em apenas um dos nomes.
        if (a.markers !== b.markers) continue;

        let rule: DuplicateRule | null = null;
        let score = 0;

        if (a.normalized && a.normalized === b.normalized) {
          rule = "EXACT_NORMALIZED";
          score = 1;
        } else if (a.tokens && a.tokens === b.tokens) {
          rule = "SAME_TOKENS";
          score = 1;
        } else if (a.compact && a.compact === b.compact) {
          rule = "COMPACT_MATCH";
          score = 1;
        } else {
          const dice = diceCoefficient(a.normalized, b.normalized);
          if (dice >= threshold) {
            rule = "HIGH_SIMILARITY";
            score = dice;
          }
        }

        if (!rule) continue;

        const [first, second] = a.store.id < b.store.id ? [a.store, b.store] : [b.store, a.store];
        pairs.push({
          aId: first.id,
          bId: second.id,
          aName: first.name,
          bName: second.name,
          chain: first.chain ?? null,
          uf: (first.uf ?? null) as string | null,
          rule,
          score: round2(score),
          severity: score >= 0.995 ? "CRITICO" : "ATENCAO",
        });
      }
    }
  }

  pairs.sort((x, y) => y.score - x.score || x.aId.localeCompare(y.aId));
  return pairs.slice(0, maxPairs);
}
