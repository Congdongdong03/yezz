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
});
