import { describe, expect, it } from "vitest";
import { insertCartItem, mergeCartAfterHydration } from "./items";
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

describe("mergeCartAfterHydration", () => {
  it("preserves projects added while a remote cart is loading", () => {
    const remoteItem: CartItem = {
      ...phoneCase,
      projectId: "remote-project",
      projectSlug: "remote-project",
    };

    expect(
      mergeCartAfterHydration({
        localItems: [{ ...phoneCase, projectId: "local-only" }],
        remoteItems: [remoteItem],
        pendingItems: [phoneCase],
      }),
    ).toEqual([remoteItem, phoneCase]);
  });

  it("keeps local precedence when the remote cart is empty and de-duplicates pending additions", () => {
    expect(
      mergeCartAfterHydration({
        localItems: [phoneCase],
        remoteItems: [],
        pendingItems: [{ ...phoneCase, price: "$66" }],
      }),
    ).toEqual([phoneCase]);
  });
});
