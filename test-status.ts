import { classifyIndustry } from "@/lib/mk9-dashboard/engine.server";
const base = { lojasContratadas: 10, checklistImports: 1, hasExecutionOrRoute: true };
const cases = [
  ["concluída", { ...base, contratadas: 100, realizadas: 100, expectedToDate: 80 }],
  ["em dia", { ...base, contratadas: 100, realizadas: 80, expectedToDate: 80 }],
  ["atenção 95%", { ...base, contratadas: 100, realizadas: 76, expectedToDate: 80 }],
  ["atenção 90%", { ...base, contratadas: 100, realizadas: 72, expectedToDate: 80 }],
  ["crítica 89%", { ...base, contratadas: 100, realizadas: 71, expectedToDate: 80 }],
  ["sem checklist", { ...base, contratadas: 100, realizadas: 0, expectedToDate: 80, checklistImports: 0 }],
  ["sem frequência", { ...base, contratadas: 0, realizadas: 5, expectedToDate: 0, lojasContratadas: 0 }],
  ["futuro", { ...base, contratadas: 100, realizadas: 0, expectedToDate: 0 }],
] as const;
for (const [name, c] of cases) console.log(name.padEnd(16), "->", classifyIndustry(c as any));
