import Fastify from "fastify";
import {
  diyProjects,
  projectCategories,
  siteSettings,
  studioWeeklyHours,
} from "@yezz/db";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AppError } from "../../lib/errors.js";
import { registerErrorHandler } from "../../plugins/error-handler.js";
import bookingsRoutes from "./bookings.routes.js";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../../test-utils/request-flow-postgres.js";
import { createBookingsService } from "../../services/bookings.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

const VERIFIED_IDENTITY = {
  clientIp: "203.0.113.10",
  requestId: "00000000-0000-4000-8000-000000000001",
  timestamp: 1_785_200_000,
  idempotencyKey: null,
};

function allowedResult() {
  return {
    allowed: true,
    limit: 5,
    remaining: 4,
    resetAt: new Date("2026-07-28T10:00:00.000Z"),
    resetAfter: 60,
  };
}

describe("bookingsRoutes durable rate limits", () => {
  beforeEach(() => {
    vi.stubEnv("REQUEST_FLOW_EXPERIENCE_ENABLED", "true");
    vi.stubEnv("REQUEST_FLOW_PARTY_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [
      "an absent experience flag",
      undefined,
      "true",
      {},
    ],
    [
      "a malformed experience flag",
      "TRUE",
      "true",
      { kind: "experience" },
    ],
    [
      "a disabled party flag",
      "true",
      "false",
      { kind: "party" },
    ],
    [
      "an unknown request kind",
      "true",
      "true",
      { kind: "product" },
    ],
  ])(
    "rejects %s before durable rate limiting",
    async (
      _label,
      experienceFlag,
      partyFlag,
      requestKind,
    ) => {
      if (experienceFlag === undefined) {
        delete process.env.REQUEST_FLOW_EXPERIENCE_ENABLED;
      } else {
        vi.stubEnv(
          "REQUEST_FLOW_EXPERIENCE_ENABLED",
          experienceFlag,
        );
      }
      vi.stubEnv("REQUEST_FLOW_PARTY_ENABLED", partyFlag);
      const consume = vi.fn();
      const create = vi.fn();
      const app = Fastify();
      registerErrorHandler(app);
      app.decorateRequest("verifiedClientIdentity", null);
      app.addHook("onRequest", async (request) => {
        request.verifiedClientIdentity = VERIFIED_IDENTITY;
      });
      app.decorate("services", {
        rateLimits: { consume },
        bookings: { create },
      } as never);
      await app.register(bookingsRoutes, { prefix: "/bookings" });

      try {
        const response = await app.inject({
          method: "POST",
          url: "/bookings",
          headers: {
            "idempotency-key":
              "00000000-0000-4000-8000-000000000009",
          },
          payload: {
            ...requestKind,
            name: "Alice",
            phone: "123",
          },
        });

        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({
          success: false,
          error: { code: "REQUEST_FLOW_DISABLED" },
        });
        expect(consume).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    },
  );

  it("keys booking creation by the verified signed client IP", async () => {
    const consume = vi.fn(async () => allowedResult());
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: { consume },
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
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        remoteAddress: "198.51.100.200",
        headers: {
          "idempotency-key": "00000000-0000-4000-8000-000000000010",
        },
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(201);
      expect(consume).toHaveBeenCalledWith("booking", "203.0.113.10", 5, 3600);
      expect(response.headers["ratelimit-remaining"]).toBe("4");
    } finally {
      await app.close();
    }
  });

  it("returns exact Retry-After metadata without creating a booking", async () => {
    const create = vi.fn();
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: {
        async consume() {
          return {
            allowed: false,
            limit: 5,
            remaining: 0,
            resetAt: new Date("2026-07-28T10:00:00.000Z"),
            resetAfter: 1234,
            retryAfter: 1234,
          };
        },
      },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: {
          "idempotency-key": "00000000-0000-4000-8000-000000000011",
        },
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("1234");
      expect(response.headers["ratelimit-remaining"]).toBe("0");
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("fails closed with 503 when durable limiting is unavailable", async () => {
    const create = vi.fn();
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: {
        async consume() {
          throw new AppError(
            503,
            "RATE_LIMIT_UNAVAILABLE",
            "Please try again shortly.",
          );
        },
      },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: {
          "idempotency-key": "00000000-0000-4000-8000-000000000012",
        },
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(503);
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it.each([
    ["missing", undefined],
    ["malformed", "not-a-uuid"],
  ])("rejects a %s Idempotency-Key before create", async (_label, key) => {
    const create = vi.fn();
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: { consume: vi.fn(async () => allowedResult()) },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        ...(key ? { headers: { "idempotency-key": key } } : {}),
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("keeps HTTP 201 for an identical replay and forwards the normalized key", async () => {
    const create = vi.fn(async () => ({
      id: "booking-1",
      status: "new",
      replayed: true,
      notification: "queued",
    }));
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      rateLimits: { consume: vi.fn(async () => allowedResult()) },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: {
          "idempotency-key": "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
        },
        payload: { name: "Alice", phone: "123" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        success: true,
        data: { id: "booking-1", replayed: true },
      });
      expect(create).toHaveBeenCalledWith(
        { name: "Alice", phone: "123" },
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      );
    } finally {
      await app.close();
    }
  });
});

describe.skipIf(!runDatabaseTests)("ordinary booking route PostgreSQL integration", () => {
  let database: RequestFlowTestDatabase;
  let projectId: string;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    const categoryId = crypto.randomUUID();
    projectId = crypto.randomUUID();
    await database.connection.db.insert(projectCategories).values({ id: categoryId, name: { en: "DIY", zh: "手作" }, slug: `route-diy-${categoryId}` });
    await database.connection.db.insert(diyProjects).values({ id: projectId, categoryId, name: { en: "Clay cup", zh: "陶杯" }, slug: `route-clay-${projectId}`, projectType: "experience", bookable: true, durationMinutes: 60, priceMin: 4300 });
    await database.connection.db.insert(siteSettings).values({ storeName: "YezYY", experienceRequestsEnabled: true });
    await database.connection.db.insert(studioWeeklyHours).values({ weekday: 0, opensAt: "09:00", closesAt: "17:00", isClosed: false });
  });

  afterEach(async () => database.close());

  it("rejects an existing ordinary idempotency key when the database gate is disabled", async () => {
    const key = crypto.randomUUID();
    const input = {
      kind: "experience" as const, mode: "booking" as const, name: "Route customer", phone: "0430000000", email: "route@example.com",
      date: "2026-08-02", startTime: "10:00", participantCount: 2, youngChildCount: 0, accompanyingAdultCount: 1,
      items: [{ projectId, quantity: 2 }], locale: "en" as const, policyVersion: "2026-07-29" as const, policyAccepted: true as const,
    };
    const bookings = createBookingsService(database.connection.db, { experience: true, product: true, party: true });
    await bookings.createOrdinaryRequest(input, key);
    await database.connection.db.update(siteSettings).set({ experienceRequestsEnabled: false });
    vi.stubEnv("REQUEST_FLOW_EXPERIENCE_ENABLED", "true");
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => { request.verifiedClientIdentity = VERIFIED_IDENTITY; });
    const consume = vi.fn(async () => allowedResult());
    app.decorate("services", { bookings, rateLimits: { consume } } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });
    try {
      const response = await app.inject({ method: "POST", url: "/bookings", headers: { "idempotency-key": key }, payload: input });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ success: false, error: { code: "REQUEST_FLOW_DISABLED" } });
      expect(consume).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
      vi.unstubAllEnvs();
    }
  });
});
