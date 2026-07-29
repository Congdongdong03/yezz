import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerErrorHandler } from "../../plugins/error-handler.js";
import availabilityRoutes from "./availability.routes.js";

describe("availability routes", () => {
  it("returns generated ordinary availability without enabling a request flow", async () => {
    const listOrdinary = vi.fn(async () => [
      {
        date: "2026-07-30",
        startTime: "09:30",
        endTime: "10:30",
        status: "available",
        remaining: 8,
      },
    ]);
    const app = Fastify();
    registerErrorHandler(app);
    app.decorate("services", { availability: { listOrdinary } } as never);
    await app.register(availabilityRoutes, { prefix: "/availability" });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/availability/ordinary?date=2026-07-30&durationMinutes=60&attendance=3",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: [
          {
            date: "2026-07-30",
            startTime: "09:30",
            endTime: "10:30",
            status: "available",
            remaining: 8,
          },
        ],
      });
      expect(listOrdinary).toHaveBeenCalledWith({
        date: "2026-07-30",
        durationMinutes: 60,
        attendance: 3,
      });
    } finally {
      await app.close();
    }
  });

  it("rejects malformed query values with the shared validation code", async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.decorate("services", { availability: { listPartyCandidates: vi.fn() } } as never);
    await app.register(availabilityRoutes, { prefix: "/availability" });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/availability/party?date=2026-07-30&guestDurationMinutes=45",
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
    } finally {
      await app.close();
    }
  });
});
