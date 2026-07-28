import { describe, expect, it } from "vitest";
import { parsePositiveInt, validateCartOrderInputLengths } from "./validation.js";

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

  it("returns fallback for fractional and non-finite numbers", () => {
    expect(parsePositiveInt("1.5", 1)).toBe(1);
    expect(parsePositiveInt(Infinity, 1)).toBe(1);
  });
});

describe("validateCartOrderInputLengths", () => {
  it("rejects a customer field longer than its API bound", () => {
    expect(() =>
      validateCartOrderInputLengths({
        name: "a".repeat(256),
        phone: "123",
        items: [{ projectName: "Pottery" }],
      }),
    ).toThrow("name must be at most 255 characters");
  });

  it("rejects an item snapshot field longer than its API bound", () => {
    expect(() =>
      validateCartOrderInputLengths({
        name: "Alice",
        phone: "123",
        items: [{ price: "1".repeat(33) }],
      }),
    ).toThrow("item price must be at most 32 characters");
  });
});
