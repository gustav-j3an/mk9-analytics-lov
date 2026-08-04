import { describe, it, expect } from "vitest";
import { normalizeMk9Role, normalizeMk9Roles } from "../roles";

describe("MK9 Roles Normalization", () => {
  it("should normalize valid roles to uppercase", () => {
    expect(normalizeMk9Role("admin")).toBe("ADMIN");
    expect(normalizeMk9Role("Admin")).toBe("ADMIN");
    expect(normalizeMk9Role("  SUPERVISOR  ")).toBe("SUPERVISOR");
  });

  it("should reject invalid roles", () => {
    expect(normalizeMk9Role("hacker")).toBe(null);
    expect(normalizeMk9Role(null)).toBe(null);
    expect(normalizeMk9Role(123)).toBe(null);
    expect(normalizeMk9Role("")).toBe(null);
  });

  it("should normalize and filter lists of roles", () => {
    const raw = ["admin", "Invalid", "supervisor", "ADMIN"];
    const normalized = normalizeMk9Roles(raw);
    expect(normalized).toEqual(["ADMIN", "SUPERVISOR"]);
    expect(normalized.length).toBe(2);
  });

  it("should return empty array for invalid input list", () => {
    expect(normalizeMk9Roles(["unknown", null])).toEqual([]);
  });
});
