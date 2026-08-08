import { describe, it, expect } from "vitest";
import { formatPercentage } from "./normalization";

describe("formatPercentage", () => {
  it("should format percentages correctly for pt-BR", () => {
    expect(formatPercentage(13.3333)).toBe("13,33%");
    expect(formatPercentage(13)).toBe("13%");
    expect(formatPercentage(0)).toBe("0%");
    expect(formatPercentage(100)).toBe("100%");
    expect(formatPercentage(-5.5)).toBe("-5,5%");
  });

  it("should handle null or undefined or NaN", () => {
    // @ts-ignore
    expect(formatPercentage(null)).toBe("0%");
    // @ts-ignore
    expect(formatPercentage(undefined)).toBe("0%");
    expect(formatPercentage(NaN)).toBe("0%");
  });
});
