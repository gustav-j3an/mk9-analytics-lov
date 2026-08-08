import { describe, it, expect } from "vitest";
import { formatPercentage } from "./normalization";

describe("formatPercentage", () => {
  it("should format percentages correctly for pt-BR", () => {
    // 13.3333 -> "13,33%"
    expect(formatPercentage(13.3333).replace(/\u00A0/g, " ")).toBe("13,33%");
    expect(formatPercentage(13).replace(/\u00A0/g, " ")).toBe("13%");
    expect(formatPercentage(0).replace(/\u00A0/g, " ")).toBe("0%");
    expect(formatPercentage(100).replace(/\u00A0/g, " ")).toBe("100%");
    expect(formatPercentage(-5.5).replace(/\u00A0/g, " ")).toBe("-5,5%");
  });

  it("should handle null or undefined or NaN", () => {
    // @ts-ignore
    expect(formatPercentage(null)).toBe("—");
    // @ts-ignore
    expect(formatPercentage(undefined)).toBe("—");
    expect(formatPercentage(NaN)).toBe("—");
  });
});
