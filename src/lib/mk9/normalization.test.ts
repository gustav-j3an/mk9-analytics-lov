
import { describe, it, expect } from "vitest";
import { formatPercentage } from "./normalization";

describe("formatPercentage", () => {
  it("formats standard percentages with up to 2 decimal places", () => {
    // Intl.NumberFormat in pt-BR environment
    expect(formatPercentage(13.333333333)).toBe("13,33%");
    expect(formatPercentage(13.3)).toBe("13,3%");
    expect(formatPercentage(13)).toBe("13%");
  });

  it("handles boundary values", () => {
    expect(formatPercentage(0)).toBe("0%");
    expect(formatPercentage(100)).toBe("100%");
  });

  it("handles null, NaN, and Infinity", () => {
    expect(formatPercentage(null as any)).toBe("—");
    expect(formatPercentage(undefined as any)).toBe("—");
    expect(formatPercentage(NaN)).toBe("—");
    expect(formatPercentage(Infinity)).toBe("—");
  });

  it("handles negative values", () => {
    // Rounding -5.555/100 -> -0.05555. With 2 digits: -0.0556 or -0.0555 depending on mode.
    // pt-BR uses comma.
    const result = formatPercentage(-5.555);
    expect(result).toMatch(/-5,5[56]%/);
  });
});
