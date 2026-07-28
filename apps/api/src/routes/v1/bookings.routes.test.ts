import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import bookingsRoutes from "./bookings.routes.js";

class InMemoryRateLimitRedis {
  private count = 0;

  async incr() {
    this.count += 1;
    return this.count;
  }

  async expire() {
    return 1;
  }

  async ttl() {
    return 1234;
  }
}

describe("bookingsRoutes", () => {
  it("sets Retry-After when the sixth booking request is rate limited", async () => {
    const app = Fastify();
    app.decorate("redis", new InMemoryRateLimitRedis() as never);
    app.decorate("services", {
      bookings: {
        async create() {
          return {
            id: "booking-1",
            status: "new",
            createdAt: new Date("2026-07-28T00:00:00.000Z"),
          };
        },
      },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      for (let requestNumber = 1; requestNumber <= 5; requestNumber += 1) {
        const response = await app.inject({
          method: "POST",
          url: "/bookings",
          payload: { name: "Alice", phone: "123" },
        });
        expect(response.statusCode).toBe(201);
      }

      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("1234");
    } finally {
      await app.close();
    }
  });
});
