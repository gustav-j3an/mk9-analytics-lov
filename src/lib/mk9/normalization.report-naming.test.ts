import { describe, it, expect } from "vitest";
import { buildIndustryReportFilename } from "./normalization";

describe("buildIndustryReportFilename", () => {
  it("deve gerar o nome correto para relatório completo", () => {
    const filename = buildIndustryReportFilename({
      industryName: "KING",
      month: 8,
      year: 2026,
      reportType: "FULL",
    });
    expect(filename).toBe("KING - Relatório - Agosto 2026.pdf");
  });

  it("deve gerar o nome correto para lojas não atendidas", () => {
    const filename = buildIndustryReportFilename({
      industryName: "KING",
      month: 8,
      year: 2026,
      reportType: "UNVISITED_STORES",
    });
    expect(filename).toBe("KING - Lojas Não Atendidas - Agosto 2026.pdf");
  });

  it("deve funcionar para diferentes indústrias e meses", () => {
    expect(buildIndustryReportFilename({
      industryName: "COPRA",
      month: 8,
      year: 2026,
      reportType: "FULL",
    })).toBe("COPRA - Relatório - Agosto 2026.pdf");

    expect(buildIndustryReportFilename({
      industryName: "COOPATOS",
      month: 7,
      year: 2026,
      reportType: "FULL",
    })).toBe("COOPATOS - Relatório - Julho 2026.pdf");
  });

  it("deve sanitizar caracteres inválidos", () => {
    // A/O QUADRADO -> AO QUADRADO
    const filename = buildIndustryReportFilename({
      industryName: "A/O QUADRADO",
      month: 8,
      year: 2026,
      reportType: "FULL",
    });
    expect(filename).toBe("AO QUADRADO - Relatório - Agosto 2026.pdf");

    // Teste com vários caracteres proibidos: / \ : * ? " < > |
    const filenameComplex = buildIndustryReportFilename({
      industryName: 'Ind: "Teste" * / \\ | < > ?',
      month: 1,
      year: 2026,
      reportType: "FULL",
    });
    expect(filenameComplex).toBe("Ind Teste - Relatório - Janeiro 2026.pdf");
  });

  it("deve preservar acentos e hífens", () => {
    const filename = buildIndustryReportFilename({
      industryName: "Indústria de Alimentos - S.A.",
      month: 12,
      year: 2025,
      reportType: "FULL",
    });
    expect(filename).toBe("Indústria de Alimentos - S.A. - Relatório - Dezembro 2025.pdf");
  });
});
