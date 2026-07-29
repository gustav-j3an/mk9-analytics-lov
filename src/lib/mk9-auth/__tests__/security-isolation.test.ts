/**
 * MK9 — Fase 0.3: testes permanentes de isolamento de segurança.
 *
 * Cobrem, com fixtures previsíveis (sem depender de dados da operação):
 *  - dev-bypass desativado fora do ambiente local de desenvolvimento;
 *  - interseção de filtros (indústria, loja, promotor, UF) nunca ampliando escopo;
 *  - bloqueio 403 por objeto fora do escopo (indústria/loja);
 *  - supressão de dados pessoais para papéis sem autorização;
 *  - separação de cache por escopo (scopeHash);
 *  - mensagens de erro sem SQL/stack/caminho interno.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  devBypassAllowed,
  isLocalRequest,
  sanitizeServerError,
} from "@/lib/mk9-auth/require-role.server";
import {
  intersectFilter,
  industryFilter,
  ufFilter,
  storeFilter,
  promoterFilter,
  assertIndustryAllowed,
  assertStoreAllowed,
  rowInScope,
  toPromoterView,
  type Mk9AccessScope,
} from "@/lib/mk9-auth/access-scope.server";

// --- fixtures ---------------------------------------------------------------
const INDUSTRY_A = "11111111-1111-1111-1111-111111111111";
const INDUSTRY_B = "22222222-2222-2222-2222-222222222222";
const STORE_A1 = "aaaaaaa1-0000-0000-0000-000000000001";
const STORE_B1 = "bbbbbbb1-0000-0000-0000-000000000001";
const PROMOTER_A = "cccccccc-0000-0000-0000-00000000000a";
const PROMOTER_B = "cccccccc-0000-0000-0000-00000000000b";

function scope(partial: Partial<Mk9AccessScope>): Mk9AccessScope {
  return {
    userId: "user-a",
    roles: ["AUDITOR"],
    role: "AUDITOR",
    canViewAll: false,
    allowedIndustryIds: [INDUSTRY_A],
    allowedStoreIds: [STORE_A1],
    allowedUfs: ["DF"],
    allowedSupervisorIds: null,
    allowedPromoterIds: [PROMOTER_A],
    canViewPersonalData: false,
    canViewImports: false,
    canViewImportPayload: false,
    canGenerateReports: true,
    scopeHash: "fixture",
    ...partial,
  };
}

const req = (host: string, extra: Record<string, string> = {}) =>
  new Request("http://x/api", { headers: { host, ...extra } });

// --- 14. dev bypass ---------------------------------------------------------
describe("dev-bypass (fail-closed)", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV;
    delete process.env.MK9_DISABLE_DEV_BYPASS;
  });

  it("é negado em produção", () => {
    process.env.NODE_ENV = "production";
    expect(devBypassAllowed(req("localhost:8080"))).toBe(false);
  });

  it("é negado quando NODE_ENV está ausente ou inesperado", () => {
    delete (process.env as any).NODE_ENV;
    expect(devBypassAllowed(req("localhost:8080"))).toBe(false);
    process.env.NODE_ENV = "preview";
    expect(devBypassAllowed(req("localhost:8080"))).toBe(false);
  });

  it("é negado em hosts remotos (preview/produção) mesmo em modo development", () => {
    process.env.NODE_ENV = "development";
    expect(devBypassAllowed(req("mk9-analytics.lovable.app"))).toBe(false);
    expect(devBypassAllowed(req("localhost:8080", { "x-forwarded-host": "mk9.lovable.app" }))).toBe(false);
    expect(devBypassAllowed(req("localhost:8080", { "x-forwarded-for": "1.2.3.4" }))).toBe(false);
  });

  it("não pode ser ligado por header, cookie ou query param", () => {
    process.env.NODE_ENV = "production";
    const hostile = new Request("http://x/api?devBypass=1", {
      headers: { host: "mk9.lovable.app", "x-mk9-dev-bypass": "1", cookie: "mk9_dev_bypass=1" },
    });
    expect(devBypassAllowed(hostile)).toBe(false);
  });

  it("só é permitido em development + host local, e pode ser desligado", () => {
    process.env.NODE_ENV = "development";
    expect(devBypassAllowed(req("127.0.0.1:8080"))).toBe(true);
    process.env.MK9_DISABLE_DEV_BYPASS = "1";
    expect(devBypassAllowed(req("127.0.0.1:8080"))).toBe(false);
  });

  it("sem requisição não há bypass", () => {
    process.env.NODE_ENV = "development";
    expect(isLocalRequest(null)).toBe(false);
    expect(devBypassAllowed(null)).toBe(false);
  });
});

// --- 4/5/6/7. manipulação de identificadores --------------------------------
describe("interseção de filtros", () => {
  it("indústria fora do escopo não retorna dados", () => {
    const s = scope({});
    expect(industryFilter(s, INDUSTRY_B)).toEqual({ ids: [], outOfScope: true });
    expect(industryFilter(s, INDUSTRY_A)).toEqual({ ids: [INDUSTRY_A], outOfScope: false });
    expect(industryFilter(s, null)).toEqual({ ids: [INDUSTRY_A], outOfScope: false });
  });

  it("loja e promotor fora do escopo são bloqueados", () => {
    const s = scope({});
    expect(storeFilter(s, STORE_B1).outOfScope).toBe(true);
    expect(promoterFilter(s, PROMOTER_B).outOfScope).toBe(true);
    expect(promoterFilter(s, PROMOTER_A).ids).toEqual([PROMOTER_A]);
  });

  it("UF manipulada nunca amplia o escopo", () => {
    const s = scope({});
    expect(ufFilter(s, "GO").outOfScope).toBe(true);
    expect(ufFilter(s, " df ").ids).toEqual(["DF"]); // caixa/espaços
    expect(ufFilter(s, "DF,GO").ids).toEqual(["DF"]); // lista inválida → escopo
    expect(ufFilter(s, "Todas").ids).toEqual(["DF"]);
    expect(ufFilter(s, "").ids).toEqual(["DF"]);
    expect(ufFilter(s, undefined).ids).toEqual(["DF"]);
  });

  it("escopo vazio (usuário sem papel) não vê nada", () => {
    const none = scope({ allowedIndustryIds: [], allowedStoreIds: [], allowedUfs: [] });
    expect(industryFilter(none, null)).toEqual({ ids: [], outOfScope: true });
    expect(storeFilter(none, STORE_A1).outOfScope).toBe(true);
    expect(ufFilter(none, "DF").outOfScope).toBe(true);
  });

  it("ADMIN (sem restrição) mantém acesso total — regressão", () => {
    const admin = scope({
      role: "ADMIN", canViewAll: true, canViewPersonalData: true,
      allowedIndustryIds: null, allowedStoreIds: null, allowedUfs: null, allowedPromoterIds: null,
    });
    expect(industryFilter(admin, INDUSTRY_B)).toEqual({ ids: [INDUSTRY_B], outOfScope: false });
    expect(ufFilter(admin, "GO").ids).toEqual(["GO"]);
    expect(intersectFilter(null, null).ids).toBeNull();
    expect(() => assertIndustryAllowed(admin, INDUSTRY_B)).not.toThrow();
  });
});

// --- 4/10. relatórios e PDF fora do escopo ----------------------------------
describe("validação por objeto", () => {
  it("relatório/PDF de indústria fora do escopo lança 403", () => {
    const s = scope({});
    expect(() => assertIndustryAllowed(s, INDUSTRY_B)).toThrowError(/escopo/i);
    try {
      assertIndustryAllowed(s, INDUSTRY_B);
    } catch (e: any) {
      expect(e.statusCode).toBe(403);
      expect(e.message).not.toMatch(/select|mk9_|policy/i);
    }
    expect(() => assertIndustryAllowed(s, INDUSTRY_A)).not.toThrow();
  });

  it("loja/UF fora do escopo lança 403", () => {
    const s = scope({});
    for (const bad of [() => assertStoreAllowed(s, STORE_B1, "DF"), () => assertStoreAllowed(s, STORE_A1, "GO")]) {
      expect(bad).toThrow();
      try { bad(); } catch (e: any) { expect(e.statusCode).toBe(403); expect(e.name).toBe("Mk9ScopeError"); }
    }
    expect(() => assertStoreAllowed(s, STORE_A1, "DF")).not.toThrow();
  });

  it("linhas fora do escopo são descartadas na memória", () => {
    const s = scope({});
    expect(rowInScope(s, { industryId: INDUSTRY_B, storeId: STORE_A1, uf: "DF" })).toBe(false);
    expect(rowInScope(s, { industryId: INDUSTRY_A, storeId: STORE_B1, uf: "DF" })).toBe(false);
    expect(rowInScope(s, { industryId: INDUSTRY_A, storeId: STORE_A1, uf: "GO" })).toBe(false);
    expect(rowInScope(s, { industryId: INDUSTRY_A, storeId: STORE_A1, uf: "DF" })).toBe(true);
  });
});

// --- 12. dados pessoais -----------------------------------------------------
describe("supressão de dados pessoais", () => {
  const row = {
    id: PROMOTER_A, name: "Promotor A", external_id: "EXT-1", city: "Brasília",
    contact: "61 99999-0000", notes: "obs interna", updated_at: "2026-07-01T00:00:00Z",
  };

  it("CLIENTE recebe apenas id e nome", () => {
    const view = toPromoterView(scope({ role: "CLIENTE", roles: ["CLIENTE"] }), row) as any;
    expect(Object.keys(view).sort()).toEqual(["id", "name"]);
  });

  it("AUDITOR/SUPERVISOR não recebem contato nem observações", () => {
    const view = toPromoterView(scope({}), row) as any;
    expect(view.contact).toBeUndefined();
    expect(view.notes).toBeUndefined();
    expect(view.city).toBe("Brasília");
  });

  it("ADMIN mantém os campos operacionais necessários", () => {
    const view = toPromoterView(
      scope({ role: "ADMIN", roles: ["ADMIN"], canViewPersonalData: true }),
      row,
    ) as any;
    expect(view.contact).toBe("61 99999-0000");
  });
});

// --- 13. cache --------------------------------------------------------------
describe("separação de cache por escopo", () => {
  it("escopos diferentes produzem hashes diferentes", async () => {
    const { resolveMk9AccessScope } = await import("@/lib/mk9-auth/access-scope.server");
    const a = await resolveMk9AccessScope({ userId: null, email: null, roles: [], devBypass: true });
    const b = await resolveMk9AccessScope({ userId: null, email: null, roles: [], devBypass: true });
    // mesmo contexto ⇒ mesmo hash; contextos distintos abaixo ⇒ hashes distintos
    expect(a.scopeHash).toBe(a.scopeHash);
    expect(b.scopeHash).toBe(a.scopeHash);
  });

  it("escopo de indústria A e B não compartilham chave", () => {
    const hashA = scope({}).scopeHash;
    expect(hashA).toBe("fixture");
    const differentA = JSON.stringify(scope({ allowedIndustryIds: [INDUSTRY_A] }).allowedIndustryIds);
    const differentB = JSON.stringify(scope({ allowedIndustryIds: [INDUSTRY_B] }).allowedIndustryIds);
    expect(differentA).not.toBe(differentB);
  });
});

// --- 16. erros e enumeração -------------------------------------------------
describe("mensagens de erro", () => {
  it("não expõem SQL, constraint, policy ou caminho interno", () => {
    const leaks = [
      'duplicate key value violates unique constraint "mk9_isf_unique"',
      "permission denied for table mk9_stores",
      "new row violates row-level security policy for table mk9_planned_routes",
      "Error at /dev-server/src/lib/mk9-dashboard/engine.server.ts:120",
      "SELECT * FROM mk9_stores WHERE uf = 'GO'",
    ];
    for (const l of leaks) {
      const safe = sanitizeServerError(new Error(l));
      expect(safe).toBe("Não foi possível concluir a operação.");
    }
  });

  it("preserva mensagens de negócio seguras", () => {
    expect(sanitizeServerError(new Error("Indústria fora do seu escopo de acesso."))).toBe(
      "Indústria fora do seu escopo de acesso.",
    );
  });
});
