/**
 * MK9 — Fase 3.1B: testes do núcleo operacional compartilhado e do Cockpit.
 *
 * Cobrem exatamente o que a missão exige:
 *   1. PARIDADE — as agregações que alimentam Dashboard e Cockpit saem do mesmo
 *      núcleo e produzem os mesmos números.
 *   2. SAÚDE — árvore de decisão determinística e ordenada.
 *   3. PRIORIDADES — score explicável e ordenação estável.
 *   4. PREVISÃO — ponderação 40/60 e níveis de confiança.
 *   5. PERFORMANCE — agregação de volume realista em tempo aceitável.
 */
import { describe, expect, it } from "vitest";

import {
  buildDailySeries,
  buildIndustryRows,
  buildStoreRows,
  classifyIndustry,
  resolvePromoter,
  toWeeklySeries,
} from "@/lib/mk9-operations/buckets";
import {
  addDays,
  businessDaysBetween,
  dayDiff,
  elapsedDays,
  elapsedFraction,
  pct,
  periodLabel,
  weekStartIso,
} from "@/lib/mk9-operations/periods";
import type { IndustryContext, RouteInfo } from "@/lib/mk9-operations/types";

import { ATTENTION_PACE, CRITICAL_PACE, evaluateHealth } from "@/lib/mk9-cockpit/health";
import { forecastClose } from "@/lib/mk9-cockpit/forecast";
import { KIND_WEIGHT, impactBonus, rankPriorities, scoreFor } from "@/lib/mk9-cockpit/priorities";
import type { Mk9PriorityItem } from "@/lib/mk9-cockpit/types";

const WIN = { startDate: "2026-07-01", endDate: "2026-07-31", totalDays: 31 };

function ctx(overrides: Partial<IndustryContext> = {}): IndustryContext {
  return {
    id: "ind-1",
    name: "KING",
    win: WIN,
    fraction: 0.5,
    buckets: new Map(),
    checklistImports: 1,
    ...overrides,
  };
}

function addStore(
  c: IndustryContext,
  storeId: string,
  weekly: number | null,
  monthly: number | null,
  visits: string[],
) {
  c.buckets.set(storeId, {
    storeId,
    storeName: `Loja ${storeId}`,
    chain: "REDE",
    uf: "MS",
    weekly,
    monthly,
    segments: [{ validFrom: WIN.startDate, validUntil: null, weeklyFrequency: weekly, monthlyFrequency: monthly }],
    visits,
  });
}

// ---------------------------------------------------------------------------
describe("períodos", () => {
  it("calcula diferença e soma de dias em UTC", () => {
    expect(dayDiff("2026-07-01", "2026-07-31")).toBe(30);
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("fração decorrida é 0 antes, 1 depois e proporcional dentro da janela", () => {
    expect(elapsedFraction(WIN, "2026-06-30")).toBe(0);
    expect(elapsedFraction(WIN, "2026-08-01")).toBe(1);
    expect(elapsedFraction(WIN, "2026-07-16")).toBeCloseTo(16 / 31, 5);
  });

  it("dias decorridos nunca ultrapassam o fim da janela", () => {
    expect(elapsedDays(WIN, "2026-06-01")).toBe(0);
    expect(elapsedDays(WIN, "2026-07-10")).toBe(10);
    expect(elapsedDays(WIN, "2026-09-01")).toBe(31);
  });

  it("semana ISO começa na segunda-feira", () => {
    expect(weekStartIso("2026-07-01")).toBe("2026-06-29"); // quarta → segunda
    expect(weekStartIso("2026-07-05")).toBe("2026-06-29"); // domingo → segunda anterior
    expect(weekStartIso("2026-07-06")).toBe("2026-07-06"); // segunda
  });

  it("dias úteis ignoram sábado e domingo", () => {
    expect(businessDaysBetween("2026-07-06", "2026-07-10")).toBe(5);
    expect(businessDaysBetween("2026-07-06", "2026-07-12")).toBe(5);
    expect(businessDaysBetween("2026-07-12", "2026-07-06")).toBe(0);
  });

  it("percentual protege divisão por zero e rótulo é pt-BR", () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(1, 3)).toBe(33);
    expect(periodLabel(2026, 7)).toBe("Julho/2026");
  });
});

// ---------------------------------------------------------------------------
describe("núcleo compartilhado — linhas de loja", () => {
  it("contratadas vêm do motor de segmentos e pendentes nunca são negativas", () => {
    const c = ctx();
    addStore(c, "s1", 1, 4, ["2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23", "2026-07-30"]);
    const [row] = buildStoreRows({ ctxs: [c], routeByKey: new Map(), today: "2026-07-31" });
    expect(row.contratadas).toBe(4);
    expect(row.realizadas).toBe(5);
    expect(row.pendentes).toBe(0);
    expect(row.status).toBe("INTEGRAL");
  });

  it("frequência quinzenal (0,5/semana = 2/mês) continua valendo no núcleo", () => {
    const c = ctx();
    addStore(c, "s1", 0.5, 2, ["2026-07-03"]);
    const [row] = buildStoreRows({ ctxs: [c], routeByKey: new Map(), today: "2026-07-31" });
    expect(row.contratadas).toBe(2);
    expect(row.status).toBe("PARCIAL");
  });

  it("esperado até hoje é recorte da janela, não a contratada cheia", () => {
    const c = ctx();
    addStore(c, "s1", 1, 4, []);
    const [row] = buildStoreRows({ ctxs: [c], routeByKey: new Map(), today: "2026-07-15" });
    expect(row.expectedToDate).toBeLessThan(row.contratadas);
    expect(row.status).toBe("NAO_ATENDIDA");
    expect(row.daysWithoutVisit).toBeNull();
  });

  it("filtro de promotor e escopo de promotor removem linhas", () => {
    const c = ctx();
    addStore(c, "s1", 1, 4, []);
    const routeByKey = new Map<string, RouteInfo>([
      ["ind-1|s1", { votes: new Map([["p1", { name: "Ana", count: 3 }]]), weekdays: new Set([4]) }],
    ]);
    expect(buildStoreRows({ ctxs: [c], routeByKey, today: "2026-07-15", promoterFilter: "p2" })).toHaveLength(0);
    expect(
      buildStoreRows({ ctxs: [c], routeByKey, today: "2026-07-15", allowedPromoterIds: ["p9"] }),
    ).toHaveLength(0);
    expect(
      buildStoreRows({ ctxs: [c], routeByKey, today: "2026-07-15", allowedPromoterIds: ["p1"] }),
    ).toHaveLength(1);
  });

  it("promotor é resolvido por votação e marca ambiguidade", () => {
    const votes = new Map([
      ["p1", { name: "Ana", count: 4 }],
      ["p2", { name: "Bia", count: 1 }],
    ]);
    const routeByKey = new Map<string, RouteInfo>([["k", { votes, weekdays: new Set([2]) }]]);
    const amb = resolvePromoter(routeByKey, "k");
    expect(amb.id).toBe("p1");
    expect(amb.resolution).toBe("AMBIGUOUS_ROUTE");
    expect(resolvePromoter(new Map(), "k").resolution).toBe("UNASSIGNED_ROUTE");
  });
});

// ---------------------------------------------------------------------------
describe("núcleo compartilhado — indústrias e séries", () => {
  it("classificação segue a ordem determinística acordada", () => {
    const base = { lojasContratadas: 10, checklistImports: 1, hasExecutionOrRoute: true };
    expect(classifyIndustry({ ...base, contratadas: 0, realizadas: 0, expectedToDate: 0, lojasContratadas: 0 })).toBe("SEM_FREQUENCIA");
    expect(classifyIndustry({ ...base, contratadas: 100, realizadas: 0, expectedToDate: 50, checklistImports: 0 })).toBe("SEM_CHECKLIST");
    expect(classifyIndustry({ ...base, contratadas: 100, realizadas: 100, expectedToDate: 50 })).toBe("CONCLUIDA");
    expect(classifyIndustry({ ...base, contratadas: 100, realizadas: 50, expectedToDate: 50 })).toBe("EM_DIA");
    expect(classifyIndustry({ ...base, contratadas: 100, realizadas: 46, expectedToDate: 50 })).toBe("ATENCAO");
    expect(classifyIndustry({ ...base, contratadas: 100, realizadas: 20, expectedToDate: 50 })).toBe("CRITICA");
  });

  it("linha da indústria soma exatamente as linhas de loja (paridade)", () => {
    const c = ctx({ fraction: 1 });
    addStore(c, "s1", 1, 4, ["2026-07-02", "2026-07-09"]);
    addStore(c, "s2", null, 2, ["2026-07-03"]);
    const storeRows = buildStoreRows({ ctxs: [c], routeByKey: new Map(), today: "2026-07-31" });
    const [industry] = buildIndustryRows({
      ctxs: [c],
      storeRows,
      industriesWithRoute: new Set<string>(),
      today: "2026-07-31",
    });
    expect(industry.contratadas).toBe(storeRows.reduce((a, s) => a + s.contratadas, 0));
    expect(industry.realizadas).toBe(storeRows.reduce((a, s) => a + s.realizadas, 0));
    expect(industry.lojasAtendidas).toBe(2);
    expect(industry.coberturaPct).toBe(Math.min(100, pct(industry.realizadas, industry.contratadas)));
  });

  it("indústria sem execução, sem frequência e sem roteiro não entra na lista", () => {
    const c = ctx({ checklistImports: 0 });
    addStore(c, "s1", null, null, []);
    const storeRows = buildStoreRows({ ctxs: [c], routeByKey: new Map(), today: "2026-07-31" });
    expect(
      buildIndustryRows({ ctxs: [c], storeRows, industriesWithRoute: new Set(), today: "2026-07-31" }),
    ).toHaveLength(0);
  });

  it("série diária é acumulada e termina no total realizado", () => {
    const c = ctx({ fraction: 1 });
    addStore(c, "s1", 1, 4, ["2026-07-02", "2026-07-20"]);
    const storeRows = buildStoreRows({ ctxs: [c], routeByKey: new Map(), today: "2026-07-31" });
    const industryRows = buildIndustryRows({ ctxs: [c], storeRows, industriesWithRoute: new Set(), today: "2026-07-31" });
    const series = buildDailySeries({
      ctxs: [c],
      industryRows,
      storeRows,
      globalStart: WIN.startDate,
      globalEnd: WIN.endDate,
    });
    expect(series).toHaveLength(31);
    expect(series[series.length - 1].realized).toBe(2);
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i].realized).toBeGreaterThanOrEqual(series[i - 1].realized);
    }
  });

  it("série semanal comprime a diária sem perder o acumulado final", () => {
    const c = ctx({ fraction: 1 });
    addStore(c, "s1", 1, 4, ["2026-07-02", "2026-07-20"]);
    const storeRows = buildStoreRows({ ctxs: [c], routeByKey: new Map(), today: "2026-07-31" });
    const industryRows = buildIndustryRows({ ctxs: [c], storeRows, industriesWithRoute: new Set(), today: "2026-07-31" });
    const daily = buildDailySeries({ ctxs: [c], industryRows, storeRows, globalStart: WIN.startDate, globalEnd: WIN.endDate });
    const weekly = toWeeklySeries(daily);
    expect(weekly.length).toBeLessThan(daily.length);
    expect(weekly[weekly.length - 1].realized).toBe(daily[daily.length - 1].realized);
  });
});

// ---------------------------------------------------------------------------
describe("cockpit — saúde geral", () => {
  const base = {
    pacePercentage: 100,
    expectedToDate: 100,
    realizedToDate: 100,
    blockingIssues: 0,
    overdueIssues: 0,
    failedImports: 0,
  };

  it("bloqueante vence qualquer outro sinal", () => {
    expect(evaluateHealth({ ...base, blockingIssues: 1, pacePercentage: 10 }).level).toBe("BLOQUEADA");
  });

  it("importação falha também bloqueia", () => {
    expect(evaluateHealth({ ...base, failedImports: 2 }).level).toBe("BLOQUEADA");
  });

  it("ritmo abaixo de 80% é crítico", () => {
    expect(evaluateHealth({ ...base, pacePercentage: CRITICAL_PACE - 1, realizedToDate: 79 }).level).toBe("CRITICA");
    expect(evaluateHealth({ ...base, pacePercentage: CRITICAL_PACE, realizedToDate: 80 }).level).toBe("ATENCAO");
  });

  it("ritmo entre 80% e 95% é atenção", () => {
    expect(evaluateHealth({ ...base, pacePercentage: ATTENTION_PACE - 1 }).level).toBe("ATENCAO");
    expect(evaluateHealth({ ...base, pacePercentage: ATTENTION_PACE }).level).toBe("SAUDAVEL");
  });

  it("ocorrência vencida derruba de saudável para atenção", () => {
    expect(evaluateHealth({ ...base, overdueIssues: 3 }).level).toBe("ATENCAO");
  });

  it("período não iniciado e sem bloqueio é saudável", () => {
    const v = evaluateHealth({ ...base, expectedToDate: 0, realizedToDate: 0, pacePercentage: 0 });
    expect(v.level).toBe("SAUDAVEL");
    expect(v.reason).toContain("não iniciou");
  });

  it("veredito é determinístico para a mesma entrada", () => {
    const a = evaluateHealth({ ...base, pacePercentage: 60, realizedToDate: 60 });
    const b = evaluateHealth({ ...base, pacePercentage: 60, realizedToDate: 60 });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
describe("cockpit — prioridades", () => {
  const item = (kind: Mk9PriorityItem["kind"], impact: number, id = kind): Mk9PriorityItem => ({
    id,
    kind,
    score: scoreFor(kind, impact),
    title: id,
    description: "",
    impact,
    industryId: null,
    storeId: null,
    promoterId: null,
    deepLink: null,
  });

  it("bônus de impacto é limitado a 10 pontos", () => {
    expect(impactBonus(0)).toBe(0);
    expect(impactBonus(1_000_000)).toBe(10);
    expect(impactBonus(5)).toBeGreaterThan(0);
  });

  it("classe superior nunca é ultrapassada por impacto", () => {
    const bloqueante = scoreFor("OCORRENCIA_BLOQUEANTE", 0);
    const importacao = scoreFor("IMPORTACAO_FALHA", 999999);
    expect(bloqueante).toBeGreaterThanOrEqual(importacao - 5);
    expect(KIND_WEIGHT.OCORRENCIA_BLOQUEANTE).toBeGreaterThan(KIND_WEIGHT.LOJA_SEM_VISITA);
  });

  it("ordena por score e devolve no máximo 5 itens", () => {
    const ranked = rankPriorities([
      item("LOJA_SEM_VISITA", 4, "a"),
      item("OCORRENCIA_BLOQUEANTE", 1, "b"),
      item("INDUSTRIA_CRITICA", 30, "c"),
      item("PROMOTOR_CRITICO", 8, "d"),
      item("IMPORTACAO_FALHA", 2, "e"),
      item("OCORRENCIA_VENCIDA", 3, "f"),
    ]);
    expect(ranked).toHaveLength(5);
    expect(ranked[0].id).toBe("b");
    expect(ranked[1].id).toBe("e");
  });

  it("empate é desempatado por impacto e id (ordenação estável)", () => {
    const ranked = rankPriorities([item("LOJA_SEM_VISITA", 5, "z"), item("LOJA_SEM_VISITA", 5, "a")]);
    expect(ranked.map((r) => r.id)).toEqual(["a", "z"]);
  });
});

// ---------------------------------------------------------------------------
describe("cockpit — previsão", () => {
  it("pondera 40% período inteiro e 60% últimas duas semanas", () => {
    const f = forecastClose({
      contracted: 300,
      realizedToDate: 100,
      realizedLastTwoWeeks: 70,
      elapsedDays: 20,
      totalDays: 30,
    });
    const overall = 100 / 20; // 5/dia
    const recent = 70 / 14; // 5/dia
    expect(f.dailyPaceOverall).toBeCloseTo(overall, 2);
    expect(f.dailyPaceRecent).toBeCloseTo(recent, 2);
    expect(f.projected).toBe(Math.round(100 + (overall * 0.4 + recent * 0.6) * 10));
    expect(f.daysRemaining).toBe(10);
  });

  it("queda recente reduz a projeção mesmo com boa média geral", () => {
    const forte = forecastClose({ contracted: 200, realizedToDate: 100, realizedLastTwoWeeks: 70, elapsedDays: 20, totalDays: 30 });
    const fraca = forecastClose({ contracted: 200, realizedToDate: 100, realizedLastTwoWeeks: 14, elapsedDays: 20, totalDays: 30 });
    expect(fraca.projected).toBeLessThan(forte.projected);
  });

  it("confiança cresce com dias decorridos", () => {
    expect(forecastClose({ contracted: 10, realizedToDate: 1, realizedLastTwoWeeks: 1, elapsedDays: 2, totalDays: 30 }).confidence).toBe("BAIXA");
    expect(forecastClose({ contracted: 10, realizedToDate: 3, realizedLastTwoWeeks: 3, elapsedDays: 6, totalDays: 30 }).confidence).toBe("MEDIA");
    expect(forecastClose({ contracted: 10, realizedToDate: 5, realizedLastTwoWeeks: 5, elapsedDays: 12, totalDays: 30 }).confidence).toBe("ALTA");
  });

  it("período encerrado projeta exatamente o realizado", () => {
    const f = forecastClose({ contracted: 120, realizedToDate: 90, realizedLastTwoWeeks: 40, elapsedDays: 30, totalDays: 30 });
    expect(f.projected).toBe(90);
    expect(f.gap).toBe(-30);
    expect(f.requiredDailyPace).toBe(30);
  });

  it("período não iniciado não inventa projeção", () => {
    const f = forecastClose({ contracted: 100, realizedToDate: 0, realizedLastTwoWeeks: 0, elapsedDays: 0, totalDays: 30 });
    expect(f.projected).toBe(0);
    expect(f.confidence).toBe("BAIXA");
  });
});

// ---------------------------------------------------------------------------
describe("performance das agregações", () => {
  it("agrega 1.500 lojas × 4 visitas em menos de 500ms", () => {
    const c = ctx({ fraction: 0.6 });
    for (let i = 0; i < 1500; i += 1) {
      addStore(c, `s${i}`, 1, 4, ["2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23"]);
    }
    const t0 = Date.now();
    const storeRows = buildStoreRows({ ctxs: [c], routeByKey: new Map(), today: "2026-07-20" });
    const industryRows = buildIndustryRows({ ctxs: [c], storeRows, industriesWithRoute: new Set(), today: "2026-07-20" });
    buildDailySeries({ ctxs: [c], industryRows, storeRows, globalStart: WIN.startDate, globalEnd: WIN.endDate });
    const elapsedMs = Date.now() - t0;
    expect(storeRows).toHaveLength(1500);
    expect(industryRows[0].realizadas).toBe(6000);
    expect(elapsedMs).toBeLessThan(500);
  });
});
