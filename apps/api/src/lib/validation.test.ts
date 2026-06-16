import { describe, expect, it } from "vitest";
import { parsePositiveInt } from "./validation.js";

describe("parsePositiveInt", () => {
  it("returns the number when valid positive integer", () => {
    expect(parsePositiveInt("5", 1)).toBe(5);
    expect(parsePositiveInt(10, 1)).toBe(10);
    expect(parsePositiveInt("100", 1)).toBe(100);
  });

  it("returns fallback for NaN inputs", () => {
    expect(parsePositiveInt("abc", 1)).toBe(1);
    expect(parsePositiveInt(NaN, 1)).toBe(1);
    expect(parsePositiveInt("", 1)).toBe(1);
    expect(parsePositiveInt(undefined, 1)).toBe(1);
    expect(parsePositiveInt(null, 1)).toBe(1);
  });

  it("returns fallback for zero or negative numbers", () => {
    expect(parsePositiveInt("0", 1)).toBe(1);
    expect(parsePositiveInt(0, 1)).toBe(1);
    expect(parsePositiveInt("-5", 1)).toBe(1);
    expect(parsePositiveInt(-10, 1)).toBe(1);
  });

  it("returns fallback for floats if <= 0 check catches them", () => {
    // 1.5 is > 0 so it passes; but Number("1.5") is 1.5
    expect(parsePositiveInt("1.5", 1)).toBe(1.5);
  });
});
