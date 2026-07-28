import { describe, expect, it } from "vitest";
import { insertCartItem } from "./items";
import type { CartItem } from "./types";

const phoneCase: CartItem = {
  projectId: "phone-case",
  projectSlug: "phone-case",
  projectName: { en: "Phone Case", zh: "手机壳" },
  projectType: "experience",
};

describe("insertCartItem", () => {
  it("adds a new project and reports true", () => {
    expect(insertCartItem([], phoneCase)).toEqual({
      items: [phoneCase],
      added: true,
    });
  });

  it("keeps the existing list and reports false for a duplicate project", () => {
    const existingItems = [phoneCase];
    const duplicateWithDifferentDetails: CartItem = {
      ...phoneCase,
      price: "$66",
    };

    const result = insertCartItem(existingItems, duplicateWithDifferentDetails);

    expect(result).toEqual({ items: existingItems, added: false });
    expect(result.items).toBe(existingItems);
  });
});
