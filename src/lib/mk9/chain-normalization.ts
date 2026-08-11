import { normalizeStoreName } from "./normalization";

const CHAIN_PATTERNS = [
  { pattern: /^atacad[aã]o/i, chain: "ATACADÃO" },
  { pattern: /^assa[ií]/i, chain: "ASSAÍ" },
  { pattern: /^dia a dia/i, chain: "DIA A DIA" },
  { pattern: /^super adega/i, chain: "SUPER ADEGA" },
  { pattern: /^carrefour/i, chain: "CARREFOUR" },
  { pattern: /^p[aã]o de ac[uú]car/i, chain: "PÃO DE AÇÚCAR" },
  { pattern: /^extra/i, chain: "EXTRA" },
  { pattern: /^massa pura/i, chain: "MASSA PURA" },
  { pattern: /^ven[ií]cius/i, chain: "VENÍCIUS" },
  { pattern: /^venicius/i, chain: "VENÍCIUS" },
  { pattern: /^tatico/i, chain: "TATICO" },
  { pattern: /^bigbox/i, chain: "BIG BOX" },
  { pattern: /^big box/i, chain: "BIG BOX" },
  { pattern: /^comper/i, chain: "COMPER" },
  { pattern: /^fort atacadista/i, chain: "FORT ATACADISTA" },
  { pattern: /^sams club/i, chain: "SAMS CLUB" },
  { pattern: /^sam'?s club/i, chain: "SAMS CLUB" },
  { pattern: /^st marche/i, chain: "ST MARCHE" },
  { pattern: /^obah/i, chain: "OBA HORTIFRUTI" },
  { pattern: /^oba hortifruti/i, chain: "OBA HORTIFRUTI" },
  { pattern: /^ultra box/i, chain: "ULTRA BOX" },
  { pattern: /^ultrabox/i, chain: "ULTRA BOX" },
  { pattern: /^veneza/i, chain: "VENEZA" },
  { pattern: /^vivendas/i, chain: "VIVENDAS" },
  { pattern: /^super bom/i, chain: "SUPERBOM" },
  { pattern: /^superbom/i, chain: "SUPERBOM" },
  { pattern: /^dona de casa/i, chain: "DONA DE CASA" },
  { pattern: /^m[ií]n[ií] pre[cç]o/i, chain: "MINI PREÇO" },
];

/**
 * Identifica a rede de uma loja a partir do nome, seguindo padrões conhecidos.
 * @param storeName Nome da loja
 * @param currentChain Rede atual cadastrada (se houver)
 * @returns Rede identificada ou null
 */
export function identifyStoreChain(storeName: string | null | undefined, currentChain?: string | null): string | null {
  // 1. Preferir dado cadastrado se for válido (não vazio e não "-")
  if (currentChain && currentChain.trim() !== "" && currentChain.trim() !== "-") {
    return currentChain.trim();
  }

  if (!storeName) return null;

  const normalized = storeName.trim();
  
  // 2. Tentar identificar por padrões conhecidos no início do nome
  for (const item of CHAIN_PATTERNS) {
    if (item.pattern.test(normalized)) {
      return item.chain;
    }
  }

  // 3. Fallback: Se o nome contém um separador claro, o que vem antes pode ser a rede
  // Mas só se for uma palavra única ou padrão muito comum (segurança contra extração ingênua)
  const parts = normalized.split(/[\-–—|]/);
  if (parts.length > 1) {
    const candidate = parts[0].trim();
    // Se a primeira parte for curta (ex: "ASSAI") e a segunda for o local
    if (candidate.length >= 3 && candidate.length <= 20) {
      // Validar se não é algo genérico como "LOJA"
      if (!/^(loja|unidade|filial|posto|supermercado|mercado)$/i.test(candidate)) {
        // Se parece um nome próprio Capitalizado ou em UPPERCASE
        return candidate.toUpperCase();
      }
    }
  }

  return null;
}

/**
 * Retorna a rede normalizada para exibição/exportação.
 * Nunca retorna "-" se puder ser identificado.
 */
export function getNormalizedChain(store: { name: string; chain?: string | null }): string {
  const identified = identifyStoreChain(store.name, store.chain);
  return identified || "-";
}
