import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import adminCatalogueRoutes from "./catalogue.routes.js";

describe("admin catalogue routes", () => {
  it("exposes protected catalogue reads and non-destructive writes", async () => {
    const adminCatalogue = {
      list: vi.fn(async () => [{ id: "catalogue-1", published: false }]),
      getById: vi.fn(async (id: string) => ({ id, published: false })),
      create: vi.fn(async (input) => ({ id: "catalogue-1", ...input })),
      update: vi.fn(async (id: string, input) => ({ id, ...input })),
    };
    const app = Fastify();
    app.decorate("services", { adminCatalogue } as never);
    await app.register(adminCatalogueRoutes, { prefix: "/catalogue" });

    const payload = {
      categoryId: "category-1",
      name: { en: "Plaster Painting", zh: "石膏彩绘" },
      slug: "plaster-painting",
      description: { en: "Paint a figurine.", zh: "彩绘摆件。" },
      durationDisplay: { en: "About 1 hour", zh: "约 1 小时" },
      occasionTags: [],
      availabilityNote: { en: "Styles vary.", zh: "款式以店内为准。" },
      published: false,
      featured: false,
      sortOrder: 0,
      coverImageUrl: null,
      imageKind: "yezyy",
      imageSourceUrl: null,
      imageLicenseUrl: null,
      imageAttribution: null,
      variants: [],
    };

    try {
      const list = await app.inject({ method: "GET", url: "/catalogue" });
      const get = await app.inject({ method: "GET", url: "/catalogue/catalogue-1" });
      const create = await app.inject({ method: "POST", url: "/catalogue", payload });
      const update = await app.inject({ method: "PATCH", url: "/catalogue/catalogue-1", payload });
      const remove = await app.inject({ method: "DELETE", url: "/catalogue/catalogue-1" });

      expect(list.json().data).toEqual([{ id: "catalogue-1", published: false }]);
      expect(get.json().data).toEqual({ id: "catalogue-1", published: false });
      expect(create.statusCode).toBe(200);
      expect(update.statusCode).toBe(200);
      expect(remove.statusCode).toBe(404);
      expect(adminCatalogue.update).toHaveBeenCalledWith("catalogue-1", payload);
    } finally {
      await app.close();
    }
  });
});
