import Fastify from "fastify";
import {
  bookings,
  diyProjects,
  partyPackages,
  projectCategories,
  requestRateLimits,
  siteSettings,
  studioWeeklyHours,
  timeSlots,
} from "@yezz/db";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { registerErrorHandler } from "../../plugins/error-handler.js";
import bookingsRoutes from "./bookings.routes.js";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../../test-utils/request-flow-postgres.js";
import { createBookingsService } from "../../services/bookings.service.js";
import { createRateLimitsRepository } from "../../repositories/rate-limits.repository.js";
import { createRateLimitsService } from "../../services/rate-limits.service.js";
import { createSettingsService } from "../../services/settings.service.js";
import { requireRequestCapability } from "../../services/settings.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";
const ordinaryTestNow = () => new Date("2026-08-01T21:00:00.000Z");

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

function ordinaryRequestPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: "experience",
    mode: "booking",
    name: "Alice",
    phone: "0430000000",
    email: "alice@example.com",
    date: "2030-08-12",
    startTime: "10:00",
    participantCount: 1,
    youngChildCount: 0,
    accompanyingAdultCount: 0,
    items: [{ projectId: "10000000-0000-4000-8000-000000000001", quantity: 1 }],
    locale: "en",
    policyVersion: "2026-07-30",
    policyAccepted: true,
    ...overrides,
  };
}

const environmentOnlySettings = {
  async requirePublicRequestCapability(capability: string) {
    requireRequestCapability(capability);
  },
};

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
        settings: environmentOnlySettings,
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

  it("does not let an accidental product environment flag reach the limiter without an effective database gate", async () => {
    vi.stubEnv("REQUEST_FLOW_PRODUCT_ENABLED", "true");
    const consume = vi.fn(async () => allowedResult());
    const create = vi.fn();
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      settings: {
        async requirePublicRequestCapability() {
          throw new AppError(503, "REQUEST_FLOW_DISABLED", "product requests are not currently available");
        },
      },
      rateLimits: { consume },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: { "idempotency-key": crypto.randomUUID() },
        payload: { kind: "product", name: "Product", phone: "0430000000" },
      });
      expect(response.statusCode).toBe(503);
      expect(consume).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("retires the legacy fixed-slot project booking payload before rate limiting", async () => {
    const consume = vi.fn(async () => allowedResult());
    const create = vi.fn();
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      settings: environmentOnlySettings,
      rateLimits: { consume },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: { "idempotency-key": crypto.randomUUID() },
        payload: {
          kind: "experience",
          mode: "booking",
          name: "Legacy customer",
          phone: "0430000000",
          email: "legacy@example.com",
          projectId: "10000000-0000-4000-8000-000000000001",
          timeSlotId: "10000000-0000-4000-8000-000000000002",
          preferredDate: "2030-08-12",
          numberOfPeople: 2,
          locale: "en",
        },
      });

      expect(response.statusCode).toBe(410);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "LEGACY_BOOKING_FLOW_RETIRED" },
      });
      expect(consume).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("keys booking creation by the verified signed client IP", async () => {
    const consume = vi.fn(async () => allowedResult());
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      settings: environmentOnlySettings,
      rateLimits: { consume },
      bookings: {
        async create(
          _input: unknown,
          _idempotencyKey: string,
          beforePersist: (tx: never) => Promise<void>,
        ) {
          await beforePersist({} as never);
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
        payload: ordinaryRequestPayload({ phone: "123" }),
      });

      expect(response.statusCode).toBe(201);
      expect(consume).toHaveBeenCalledWith(
        "booking",
        "203.0.113.10",
        5,
        3600,
        expect.anything(),
      );
      expect(response.headers["ratelimit-remaining"]).toBe("4");
    } finally {
      await app.close();
    }
  });

  it("returns exact Retry-After metadata without creating a booking", async () => {
    const persist = vi.fn();
    const create = vi.fn(
      async (
        _input: unknown,
        _idempotencyKey: string,
        beforePersist: (tx: never) => Promise<void>,
      ) => {
        await beforePersist({} as never);
        return persist();
      },
    );
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      settings: environmentOnlySettings,
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
        payload: ordinaryRequestPayload({ phone: "123" }),
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("1234");
      expect(response.headers["ratelimit-remaining"]).toBe("0");
      expect(create).toHaveBeenCalledTimes(1);
      expect(persist).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("fails closed with 503 when durable limiting is unavailable", async () => {
    const persist = vi.fn();
    const create = vi.fn(
      async (
        _input: unknown,
        _idempotencyKey: string,
        beforePersist: (tx: never) => Promise<void>,
      ) => {
        await beforePersist({} as never);
        return persist();
      },
    );
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      settings: environmentOnlySettings,
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
        payload: ordinaryRequestPayload({ phone: "123" }),
      });

      expect(response.statusCode).toBe(503);
      expect(create).toHaveBeenCalledTimes(1);
      expect(persist).not.toHaveBeenCalled();
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
      settings: environmentOnlySettings,
      rateLimits: { consume: vi.fn(async () => allowedResult()) },
      bookings: { create },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        ...(key ? { headers: { "idempotency-key": key } } : {}),
        payload: ordinaryRequestPayload({ phone: "123" }),
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
    const create = vi.fn(
      async (
        _input: unknown,
        _idempotencyKey: string,
        beforePersist: (tx: never) => Promise<void>,
      ) => {
        await beforePersist({} as never);
        return {
          id: "booking-1",
          status: "new",
          replayed: true,
          notification: "queued",
        };
      },
    );
    const app = Fastify();
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      settings: environmentOnlySettings,
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
        payload: ordinaryRequestPayload({ phone: "123" }),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        success: true,
        data: { id: "booking-1", replayed: true },
      });
      expect(create).toHaveBeenCalledWith(
        ordinaryRequestPayload({ phone: "123" }),
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        expect.any(Function),
      );
    } finally {
      await app.close();
    }
  });
});

describe.skipIf(!runDatabaseTests)("ordinary booking route PostgreSQL integration", () => {
  let database: RequestFlowTestDatabase;
  let projectId: string;
  let slotId: string;
  let partyPackageId: string;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    const categoryId = crypto.randomUUID();
    projectId = crypto.randomUUID();
    slotId = crypto.randomUUID();
    partyPackageId = crypto.randomUUID();
    await database.connection.db.insert(projectCategories).values({ id: categoryId, name: { en: "DIY", zh: "手作" }, slug: `route-diy-${categoryId}` });
    await database.connection.db.insert(diyProjects).values({ id: projectId, categoryId, name: { en: "Clay cup", zh: "陶杯" }, slug: `route-clay-${projectId}`, projectType: "experience", bookable: true, durationMinutes: 60, priceMin: 4300 });
    await database.connection.db.insert(timeSlots).values({
      id: slotId,
      date: "2026-08-02",
      startTime: "10:00",
      endTime: "11:00",
      capacity: 8,
      categoryId,
    });
    await database.connection.db.insert(partyPackages).values({
      id: partyPackageId,
      name: { en: "Party", zh: "派对" },
      slug: `route-party-${partyPackageId}`,
      minPeople: 4,
      maxPeople: 8,
      guestDurationMinutes: 90,
      setupMinutes: 30,
      cleanupMinutes: 30,
      venueFeeCents: 9500,
      minSpendPerPersonCents: 4500,
    });
    await database.connection.db.insert(siteSettings).values({ storeName: "YezYY", experienceRequestsEnabled: true, partyRequestsEnabled: true, productRequestsEnabled: true });
    await database.connection.db.insert(studioWeeklyHours).values({ weekday: 0, opensAt: "09:00", closesAt: "17:00", isClosed: false });
  });

  afterEach(async () => database.close());

  async function createGatedApp(environment: {
    REQUEST_FLOW_EXPERIENCE_ENABLED: string;
    REQUEST_FLOW_PARTY_ENABLED: string;
    REQUEST_FLOW_PRODUCT_ENABLED?: string;
  }) {
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => {
      request.verifiedClientIdentity = VERIFIED_IDENTITY;
    });
    app.decorate("services", {
      settings: createSettingsService(database.connection.db, null, environment),
      bookings: createBookingsService(database.connection.db, {
        experience: environment.REQUEST_FLOW_EXPERIENCE_ENABLED === "true",
        party: environment.REQUEST_FLOW_PARTY_ENABLED === "true",
        product: false,
      }, { now: ordinaryTestNow }),
      rateLimits: createRateLimitsService(
        createRateLimitsRepository(database.connection.db),
        { hashSecret: "route-gate-test-rate-limit-secret" },
      ),
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });
    return app;
  }

  it("dispatches an enabled ordinary request after consuming exactly one durable rate bucket", async () => {
    const app = await createGatedApp({
      REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
      REQUEST_FLOW_PARTY_ENABLED: "true",
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: { "idempotency-key": crypto.randomUUID() },
        payload: {
          kind: "experience",
          mode: "booking",
          name: "Enabled ordinary",
          phone: "0430000000",
          email: "enabled-ordinary@example.com",
          date: "2026-08-02",
          startTime: "10:00",
          participantCount: 2,
          youngChildCount: 0,
          accompanyingAdultCount: 1,
          items: [{ projectId, quantity: 2 }],
          locale: "en",
          policyVersion: "2026-07-30",
          policyAccepted: true,
        },
      });
      expect(response.statusCode).toBe(201);
      await expect(database.connection.db.select().from(requestRateLimits)).resolves.toHaveLength(1);
      await expect(database.connection.db.select().from(bookings)).resolves.toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("does not reserve a legacy fixed slot when experience requests are enabled", async () => {
    const app = await createGatedApp({
      REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
      REQUEST_FLOW_PARTY_ENABLED: "true",
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: { "idempotency-key": crypto.randomUUID() },
        payload: {
          kind: "experience",
          mode: "booking",
          projectId,
          timeSlotId: slotId,
          preferredDate: "2026-08-02",
          numberOfPeople: 2,
          name: "Legacy slot customer",
          phone: "0430000000",
          email: "legacy-slot@example.com",
          locale: "en",
        },
      });

      expect(response.statusCode).toBe(410);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "LEGACY_BOOKING_FLOW_RETIRED" },
      });
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      expect(slot?.bookedCount).toBe(0);
      await expect(database.connection.db.select().from(bookings)).resolves.toHaveLength(0);
      await expect(database.connection.db.select().from(requestRateLimits)).resolves.toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("keeps product hard-disabled even when both deployment and database flags are true", async () => {
    const app = await createGatedApp({
      REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
      REQUEST_FLOW_PARTY_ENABLED: "true",
      REQUEST_FLOW_PRODUCT_ENABLED: "true",
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: { "idempotency-key": crypto.randomUUID() },
        payload: { kind: "product", name: "Product", phone: "0430000000" },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        success: false,
        error: { code: "REQUEST_FLOW_DISABLED" },
      });
      await expect(database.connection.db.select().from(requestRateLimits)).resolves.toHaveLength(0);
      await expect(database.connection.db.select().from(bookings)).resolves.toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("blocks an existing legacy replay when the deployment gate is disabled", async () => {
    const key = crypto.randomUUID();
    const input = {
      name: "Legacy env replay",
      phone: "0430000000",
      email: "legacy-env-replay@example.com",
      projectId,
      timeSlotId: slotId,
      preferredDate: "2026-08-02",
      numberOfPeople: 2,
      locale: "en" as const,
    };
    await createBookingsService(database.connection.db, {
      experience: true,
      party: true,
      product: false,
    }).create(input, key);
    const app = await createGatedApp({
      REQUEST_FLOW_EXPERIENCE_ENABLED: "false",
      REQUEST_FLOW_PARTY_ENABLED: "true",
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/bookings",
        headers: { "idempotency-key": key },
        payload: input,
      });
      expect(response.statusCode).toBe(503);
      await expect(database.connection.db.select().from(bookings)).resolves.toHaveLength(1);
      await expect(database.connection.db.select().from(requestRateLimits)).resolves.toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it.each([
    ["legacy experience", { name: "Legacy", phone: "0430000000", email: "legacy@example.com" }],
    ["ordinary experience", { kind: "experience", mode: "booking", name: "Ordinary", phone: "0430000000", email: "ordinary@example.com" }],
    ["party", { kind: "party", name: "Party", phone: "0430000000", email: "party@example.com" }],
  ])(
    "rejects disabled database gates for %s before dispatch or durable rate limiting",
    async (_label, payload) => {
      await database.connection.db.update(siteSettings).set({
        experienceRequestsEnabled: false,
        partyRequestsEnabled: false,
      });
      const app = await createGatedApp({
        REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
        REQUEST_FLOW_PARTY_ENABLED: "true",
      });
      try {
        const response = await app.inject({
          method: "POST",
          url: "/bookings",
          headers: { "idempotency-key": crypto.randomUUID() },
          payload,
        });
        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({
          success: false,
          error: { code: "REQUEST_FLOW_DISABLED" },
        });
        await expect(database.connection.db.select().from(requestRateLimits)).resolves.toHaveLength(0);
        await expect(database.connection.db.select().from(bookings)).resolves.toHaveLength(0);
      } finally {
        await app.close();
      }
    },
  );

  it.each([
    ["legacy experience", { name: "Legacy", phone: "0430000000", email: "legacy@example.com" }],
    ["ordinary experience", { kind: "experience", mode: "booking", name: "Ordinary", phone: "0430000000", email: "ordinary@example.com" }],
    ["party", { kind: "party", name: "Party", phone: "0430000000", email: "party@example.com" }],
  ])(
    "rejects disabled deployment gates for %s before dispatch or durable rate limiting",
    async (_label, payload) => {
      const app = await createGatedApp({
        REQUEST_FLOW_EXPERIENCE_ENABLED: "false",
        REQUEST_FLOW_PARTY_ENABLED: "false",
      });
      try {
        const response = await app.inject({
          method: "POST",
          url: "/bookings",
          headers: { "idempotency-key": crypto.randomUUID() },
          payload,
        });
        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({
          success: false,
          error: { code: "REQUEST_FLOW_DISABLED" },
        });
        await expect(database.connection.db.select().from(requestRateLimits)).resolves.toHaveLength(0);
        await expect(database.connection.db.select().from(bookings)).resolves.toHaveLength(0);
      } finally {
        await app.close();
      }
    },
  );

  it("rejects an existing ordinary idempotency key when the database gate is disabled", async () => {
    const key = crypto.randomUUID();
    const input = {
      kind: "experience" as const, mode: "booking" as const, name: "Route customer", phone: "0430000000", email: "route@example.com",
      date: "2026-08-02", startTime: "10:00", participantCount: 2, youngChildCount: 0, accompanyingAdultCount: 1,
      items: [{ projectId, quantity: 2 }], locale: "en" as const, policyVersion: "2026-07-30" as const, policyAccepted: true as const,
    };
    const bookings = createBookingsService(
      database.connection.db,
      { experience: true, product: true, party: true },
      { now: ordinaryTestNow },
    );
    await bookings.createOrdinaryRequest(input, key);
    await database.connection.db.update(siteSettings).set({ experienceRequestsEnabled: false });
    vi.stubEnv("REQUEST_FLOW_EXPERIENCE_ENABLED", "true");
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest("verifiedClientIdentity", null);
    app.addHook("onRequest", async (request) => { request.verifiedClientIdentity = VERIFIED_IDENTITY; });
    const consume = vi.fn(async () => allowedResult());
    app.decorate("services", {
      settings: createSettingsService(database.connection.db, null, {
        REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
        REQUEST_FLOW_PARTY_ENABLED: "true",
      }),
      bookings,
      rateLimits: { consume },
    } as never);
    await app.register(bookingsRoutes, { prefix: "/bookings" });
    try {
      const response = await app.inject({ method: "POST", url: "/bookings", headers: { "idempotency-key": key }, payload: input });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ success: false, error: { code: "REQUEST_FLOW_DISABLED" } });
      expect(consume).toHaveBeenCalledTimes(0);
    } finally {
      await app.close();
      vi.unstubAllEnvs();
    }
  });
});
