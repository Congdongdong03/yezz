import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import adminSettingsRoutes from "./settings.routes.js";

describe("admin structured schedule routes", () => {
  async function createApp() {
    const app = Fastify();
    app.decorate("services", {
      adminSettings: {
        get: vi.fn(),
        update: vi.fn(),
        getSchedule: vi.fn(async () => ({
          timeZone: "Australia/Melbourne",
          weekly: [],
          specialHours: [],
          closures: [],
        })),
        updateWeekly: vi.fn(async (days) => ({ weekly: days })),
        upsertSpecialHours: vi.fn(async (input) => input),
        createClosure: vi.fn(async (input) => ({
          id: "closure-1",
          ...input,
        })),
        deleteClosure: vi.fn(async (id) => ({ id })),
        updateRequestSwitches: vi.fn(async () => ({
          database: { experience: true, party: false, product: false },
          deploymentHardGate: {
            experience: false,
            party: false,
            product: false,
          },
          effective: { experience: false, party: false, product: false },
        })),
      },
    } as never);
    await app.register(adminSettingsRoutes, { prefix: "/settings" });
    return app;
  }

  it("exposes the structured schedule read and write contract", async () => {
    const app = await createApp();
    try {
      const schedule = await app.inject({
        method: "GET",
        url: "/settings/schedule",
      });
      const weekly = await app.inject({
        method: "PUT",
        url: "/settings/schedule/weekly",
        payload: {
          days: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            opensAt: "09:30",
            closesAt: "17:00",
            isClosed: false,
          })),
        },
      });
      const special = await app.inject({
        method: "POST",
        url: "/settings/schedule/special-hours",
        payload: {
          date: "2026-08-01",
          opensAt: "11:00",
          closesAt: "15:00",
          isClosed: false,
        },
      });
      const closure = await app.inject({
        method: "POST",
        url: "/settings/schedule/closures",
        payload: {
          date: "2026-08-01",
          startTime: "12:00",
          endTime: "12:30",
        },
      });
      const deleted = await app.inject({
        method: "DELETE",
        url: "/settings/schedule/closures/closure-1",
      });

      expect(schedule.statusCode).toBe(200);
      expect(schedule.json().data.timeZone).toBe("Australia/Melbourne");
      expect(weekly.statusCode).toBe(200);
      expect(weekly.json().data.weekly).toHaveLength(7);
      expect(special.json().data.date).toBe("2026-08-01");
      expect(closure.json().data.id).toBe("closure-1");
      expect(deleted.json().data).toEqual({ id: "closure-1" });
    } finally {
      await app.close();
    }
  });

  it("returns database, hard-gate, and effective switch states", async () => {
    const app = await createApp();
    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/settings/request-switches",
        payload: { experience: true, product: true },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        database: { experience: true, party: false, product: false },
        deploymentHardGate: {
          experience: false,
          party: false,
          product: false,
        },
        effective: { experience: false, party: false, product: false },
      });
    } finally {
      await app.close();
    }
  });
});
