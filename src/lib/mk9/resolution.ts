// Camada de resolução: dado o IR do parser + snapshot do banco,
// resolve nomes -> IDs. Puro. Sem I/O.
import type {
  IndustryRecord,
  PromoterRecord,
  StoreRecord,
} from "./types";
import { normalizeName, normalizePhone } from "./normalization";

export interface ResolutionResult<T> {
  match: T | null;
  ambiguous: boolean;
  candidates: T[];
}

export function resolveIndustry(
  name: string,
  db: IndustryRecord[],
): ResolutionResult<IndustryRecord> {
  const norm = normalizeName(name);
  if (!norm) return { match: null, ambiguous: false, candidates: [] };
  const exact = db.filter((it) => it.nameNormalized === norm);
  if (exact.length === 1) return { match: exact[0], ambiguous: false, candidates: exact };
  if (exact.length > 1) return { match: null, ambiguous: true, candidates: exact };
  return { match: null, ambiguous: false, candidates: [] };
}

export function resolveStore(
  name: string,
  uf: string | null | undefined,
  chain: string | null | undefined,
  db: StoreRecord[],
): ResolutionResult<StoreRecord> {
  const norm = normalizeName(name);
  if (!norm) return { match: null, ambiguous: false, candidates: [] };
  let candidates = db.filter((s) => s.nameNormalized === norm);
  if (uf) {
    const withUf = candidates.filter((s) => (s.uf ?? null) === uf);
    if (withUf.length) candidates = withUf;
  }
  if (chain && candidates.length > 1) {
    const chainNorm = normalizeName(chain);
    const withChain = candidates.filter((s) => normalizeName(s.chain ?? "") === chainNorm);
    if (withChain.length) candidates = withChain;
  }
  if (candidates.length === 1) return { match: candidates[0], ambiguous: false, candidates };
  if (candidates.length > 1) return { match: null, ambiguous: true, candidates };
  return { match: null, ambiguous: false, candidates: [] };
}

export function resolvePromoter(
  name: string,
  externalId: string | null | undefined,
  contact: string | null | undefined,
  db: PromoterRecord[],
): ResolutionResult<PromoterRecord> {
  if (externalId) {
    const byExt = db.filter((p) => p.externalId === externalId);
    if (byExt.length === 1) return { match: byExt[0], ambiguous: false, candidates: byExt };
  }
  const norm = normalizeName(name);
  if (norm) {
    const byName = db.filter((p) => p.nameNormalized === norm);
    if (byName.length === 1) return { match: byName[0], ambiguous: false, candidates: byName };
    if (byName.length > 1) {
      const contactN = normalizePhone(contact);
      if (contactN) {
        const disambig = byName.filter((p) => p.contactNormalized === contactN);
        if (disambig.length === 1) return { match: disambig[0], ambiguous: false, candidates: disambig };
      }
      return { match: null, ambiguous: true, candidates: byName };
    }
  }
  const contactN = normalizePhone(contact);
  if (contactN) {
    const byContact = db.filter((p) => p.contactNormalized === contactN);
    if (byContact.length === 1) return { match: byContact[0], ambiguous: false, candidates: byContact };
  }
  return { match: null, ambiguous: false, candidates: [] };
}
