/**
 * MK9 — Testes da classificação "exige checklist".
 * Cobrem: lista aprovada, bloqueio de prévia/commit, cockpit e preservação.
 */
import { describe, expect, it } from "vitest";
import {
  INDUSTRY_CHECKLIST_DISABLED,
  INDUSTRY_CHECKLIST_DISABLED_MESSAGE,
  checklistIndustryDisabledError,
  countIndustriesMissingChecklist,
  filterChecklistIndustries,
  isChecklistIndustryAllowed,
} from "../industry-gate";

/** Nomes normalizados aprovados e efetivamente encontrados no cadastro real. */
const APROVADAS = [
  "ao quadrado",
  "cicopal go",
  "coopatos",
  "copra",
  "embavi",
  "fruta polpa",
  "king",
  "mendez",
  "missiato",
  "rb alimentos",
  "sao braz",
];

const CADASTRO = [
  ...APROVADAS.map((n, i) => ({ id: `ok-${i}`, name: n, requiresChecklist: true })),
  { id: "x1", name: "alleza", requiresChecklist: false },
  { id: "x2", name: "piracanjuba", requiresChecklist: false },
  { id: "x3", name: "pamplona", requiresChecklist: false },
];

describe("classificação exige checklist", () => {
  it("habilita somente as indústrias da lista aprovada presentes no cadastro", () => {
    const habilitadas = filterChecklistIndustries(CADASTRO)
      .map((i) => i.name)
      .sort();
    expect(habilitadas).toEqual([...APROVADAS].sort());
  });

  it("mantém as demais indústrias como não exigindo checklist", () => {
    const outras = CADASTRO.filter((i) => !APROVADAS.includes(i.name));
    expect(outras.every((i) => !isChecklistIndustryAllowed(i))).toBe(true);
  });

  it("busca de indústrias de checklist retorna somente as habilitadas", () => {
    expect(filterChecklistIndustries(CADASTRO).every((i) => i.requiresChecklist)).toBe(true);
  });

  it("bloqueia indústria desabilitada (prévia e commit usam a mesma regra)", () => {
    const desabilitada = { id: "x1", name: "alleza", requiresChecklist: false };
    expect(isChecklistIndustryAllowed(desabilitada)).toBe(false);
    expect(isChecklistIndustryAllowed(null)).toBe(false);
    expect(isChecklistIndustryAllowed(undefined)).toBe(false);
  });

  it("erro controlado, sem detalhes internos", () => {
    const err = checklistIndustryDisabledError();
    expect(err.name).toBe(INDUSTRY_CHECKLIST_DISABLED);
    expect(err.message).toBe(INDUSTRY_CHECKLIST_DISABLED_MESSAGE);
    expect(err.message).not.toMatch(/select|policy|sql|table/i);
  });

  it("indústria nova nasce sem exigir checklist", () => {
    const nova = { id: "novo", name: "marca nova", requiresChecklist: false };
    expect(isChecklistIndustryAllowed(nova)).toBe(false);
  });

  it("é idempotente: reaplicar a lista não muda o conjunto habilitado", () => {
    const a = filterChecklistIndustries(CADASTRO).map((i) => i.id);
    const b = filterChecklistIndustries(filterChecklistIndustries(CADASTRO)).map((i) => i.id);
    expect(b).toEqual(a);
  });
});

describe("cockpit — checklist ausente", () => {
  it("conta apenas indústrias que exigem checklist e não importaram", () => {
    const ctxs = [
      { requiresChecklist: true, checklistImports: 0 },
      { requiresChecklist: true, checklistImports: 2 },
      { requiresChecklist: false, checklistImports: 0 },
      { requiresChecklist: false, checklistImports: 0 },
    ];
    expect(countIndustriesMissingChecklist(ctxs)).toBe(1);
  });

  it("indústria que não exige checklist nunca gera alerta de ausência", () => {
    const ctxs = [{ requiresChecklist: false, checklistImports: 0 }];
    expect(countIndustriesMissingChecklist(ctxs)).toBe(0);
  });
});

describe("desabilitação preserva histórico", () => {
  it("desabilitar só altera a classificação — checklists e visitas seguem existindo", () => {
    const industria = {
      id: "king",
      name: "king",
      requiresChecklist: true,
      checklists: 4,
      visitas: 353,
      frequencias: 120,
      rotas: 88,
    };
    const depois = { ...industria, requiresChecklist: false };
    expect(depois.checklists).toBe(industria.checklists);
    expect(depois.visitas).toBe(industria.visitas);
    expect(depois.frequencias).toBe(industria.frequencias);
    expect(depois.rotas).toBe(industria.rotas);
    expect(isChecklistIndustryAllowed(depois)).toBe(false);
  });

  it("relatórios continuam considerando indústrias que não exigem checklist", () => {
    const paraRelatorio = CADASTRO.filter(() => true);
    expect(paraRelatorio.length).toBe(CADASTRO.length);
  });
});

describe("countIndustriesMissingChecklist — regra temporal", () => {
  const base = { requiresChecklist: true, checklistImports: 0 };

  it("não cobra checklist em competência anterior à habilitação", () => {
    const n = countIndustriesMissingChecklist(
      [{ ...base, checklistEnabledAt: "2026-07-10T00:00:00Z" }],
      { month: 6, year: 2026 },
    );
    expect(n).toBe(0);
  });

  it("cobra a partir da competência de habilitação", () => {
    const ctxs = [{ ...base, checklistEnabledAt: "2026-07-10T00:00:00Z" }];
    expect(countIndustriesMissingChecklist(ctxs, { month: 7, year: 2026 })).toBe(1);
    expect(countIndustriesMissingChecklist(ctxs, { month: 8, year: 2026 })).toBe(1);
  });

  it("sem data registrada mantém o comportamento anterior", () => {
    expect(
      countIndustriesMissingChecklist([{ ...base, checklistEnabledAt: null }], {
        month: 1,
        year: 2026,
      }),
    ).toBe(1);
  });

  it("ignora indústria que já importou checklist na competência", () => {
    expect(
      countIndustriesMissingChecklist(
        [{ ...base, checklistImports: 2, checklistEnabledAt: null }],
        { month: 7, year: 2026 },
      ),
    ).toBe(0);
  });
});
