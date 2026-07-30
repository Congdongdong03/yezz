import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerErrorHandler } from "../../plugins/error-handler.js";
import { AppError } from "../../lib/errors.js";
import catalogueRoutes from "./catalogue.routes.js";

describe("catalogue routes", () => {
  it("serves the public catalogue and keeps an unpublished slug private", async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.decorate("services", {
      catalogue: {
        list: async () => [{ slug: "plaster-painting" }],
        getBySlug: async (slug: string) => {
          if (slug === "private") {
            throw new AppError(
              404,
              "NOT_FOUND",
              "Catalogue entry not found: private",
            );
          }
          return { slug };
        },
      },
    } as never);
    await app.register(catalogueRoutes, { prefix: "/api/v1/catalogue" });

    try {
      expect(
        (await app.inject({ method: "GET", url: "/api/v1/catalogue" }))
          .statusCode,
      ).toBe(200);
      expect(
        (await app.inject({ method: "GET", url: "/api/v1/catalogue/private" }))
          .statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });
});
