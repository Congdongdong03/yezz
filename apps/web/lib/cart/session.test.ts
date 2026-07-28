import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCartFromServer, saveCartToServer } from "./session";
import type { CartItem } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cart session transport", () => {
  it("loads the cart through the relative same-origin backend", async () => {
    const item: CartItem = {
      projectId: "project-1",
      projectSlug: "project",
      projectName: { en: "Project", zh: "项目" },
      projectType: "product",
    };
    const request = vi.fn(async () =>
      Response.json({ success: true, data: { items: [item] } }),
    );
    vi.stubGlobal("fetch", request);

    await expect(loadCartFromServer()).resolves.toEqual([item]);
    expect(request).toHaveBeenCalledWith("/api/backend/v1/cart", {
      credentials: "include",
    });
  });

  it("saves the cart through the relative same-origin backend", async () => {
    const item: CartItem = {
      projectId: "project-1",
      projectSlug: "project",
      projectName: { en: "Project", zh: "项目" },
      projectType: "product",
    };
    const request = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", request);

    await saveCartToServer([item]);

    expect(request).toHaveBeenCalledWith("/api/backend/v1/cart", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [item] }),
    });
  });
});
