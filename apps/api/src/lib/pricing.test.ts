import { describe, expect, it } from "vitest";
import {
  formatPriceDisplay,
  formatStylePrice,
  parsePriceRangeString,
  resolveProjectPricing,
} from "./pricing.js";

describe("pricing helpers", () => {
  it("parses CNY price range strings", () => {
    expect(parsePriceRangeString("¥68 - ¥128")).toEqual({ min: 68, max: 128 });
    expect(parsePriceRangeString("¥198/person")).toEqual({ min: 198, max: 198 });
  });

  it("formats project price display", () => {
    expect(
      formatPriceDisplay({ min: 88, max: 128, currency: "CNY" }),
    ).toBe("¥88 - ¥128");
    expect(
      resolveProjectPricing({
        priceRange: null,
        priceMin: 88,
        priceMax: 128,
        priceCurrency: "CNY",
      }).priceDisplay,
    ).toBe("¥88 - ¥128");
  });

  it("formats numeric style prices with currency", () => {
    expect(formatStylePrice("128", "CNY")).toBe("¥128");
  });

  it("defaults a numeric range to AUD", () => {
    expect(formatPriceDisplay({ min: 45, max: 65 })).toBe("$45–$65");
  });

  it("defaults a project without a currency to AUD", () => {
    expect(
      resolveProjectPricing({
        priceMin: 45,
        priceMax: 45,
        priceRange: null,
        priceCurrency: null,
      }).priceDisplay,
    ).toBe("$45");
  });
});
