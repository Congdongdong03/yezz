import Fastify, { type FastifyInstance } from "fastify";
import {
  bookings,
  diyProjects,
  emailOutbox,
  partyPackages,
  projectCategories,
  requestRateLimits,
  siteSettings,
  studioWeeklyHours,
  timeSlots,
} from "@yezz/db";
import { eq, sql } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createRateLimitsRepository } from "../../repositories/rate-limits.repository.js";
import { createSettingsRepository } from "../../repositories/settings.repository.js";
import { createAdminSettingsService } from "../../services/admin/settings.admin.service.js";
import { createBookingsService } from "../../services/bookings.service.js";
import { createRateLimitsService } from "../../services/rate-limits.service.js";
import { createSettingsService } from "../../services/settings.service.js";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../../test-utils/request-flow-postgres.js";
import { registerErrorHandler } from "../../plugins/error-handler.js";
import bookingsRoutes from "./bookings.routes.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";
const INSERT_LOCK_CLASS = 1_987_260_730;
const INSERT_LOCK_KEY = 73_001;
const REQUEST_ENVIRONMENT = {
  REQUEST_FLOW_EXPERIENCE_ENABLED: "true",
  REQUEST_FLOW_PARTY_ENABLED: "true",
  REQUEST_FLOW_PRODUCT_ENABLED: "false",
} as const;
const REQUEST_CAPABILITIES = {
  experience: true,
  party: true,
  product: false,
} as const;

type Deferred = {
  promise: Promise<void>;
  resolve(): void;
};

function deferred(): Deferred {
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  let settled = false;
  return {
    promise,
    resolve() {
      if (settled) return;
      settled = true;
      resolvePromise();
    },
  };
}

describe.skipIf(!runDatabaseTests)(
  "public capability closure PostgreSQL linearization",
  () => {
    let database: RequestFlowTestDatabase;
    let app: FastifyInstance;
    let settingsId: string;
    let projectId: string;
    let slotId: string;
    let partyPackageId: string;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
      const categoryId = crypto.randomUUID();
      projectId = crypto.randomUUID();
      slotId = crypto.randomUUID();
      partyPackageId = crypto.randomUUID();
      settingsId = crypto.randomUUID();

      await database.connection.db.insert(projectCategories).values({
        id: categoryId,
        name: { en: "Capability DIY", zh: "能力手作" },
        slug: `capability-${categoryId}`,
      });
      await database.connection.db.insert(diyProjects).values({
        id: projectId,
        categoryId,
        name: { en: "Capability project", zh: "能力项目" },
        slug: `capability-${projectId}`,
        projectType: "experience",
        bookable: true,
        durationMinutes: 60,
        priceMin: 4_300,
      });
      await database.connection.db.insert(timeSlots).values({
        id: slotId,
        date: "2030-08-12",
        startTime: "10:00",
        endTime: "11:00",
        capacity: 8,
        categoryId,
      });
      await database.connection.db.insert(partyPackages).values({
        id: partyPackageId,
        name: { en: "Capability party", zh: "能力派对" },
        slug: `capability-party-${partyPackageId}`,
        minPeople: 4,
        maxPeople: 8,
        guestDurationMinutes: 90,
        setupMinutes: 30,
        cleanupMinutes: 30,
        venueFeeCents: 9_500,
        minSpendPerPersonCents: 4_500,
      });
      await database.connection.db.insert(siteSettings).values({
        id: settingsId,
        storeName: "YezYY",
        experienceRequestsEnabled: true,
        partyRequestsEnabled: true,
        productRequestsEnabled: false,
      });
      await database.connection.db.insert(studioWeeklyHours).values(
        Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          opensAt: "09:00",
          closesAt: "18:00",
          isClosed: false,
        })),
      );

      await database.bootstrap.client.unsafe(`
        CREATE FUNCTION "${database.schema}".block_capability_booking_insert()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          PERFORM pg_advisory_xact_lock(${INSERT_LOCK_CLASS}, ${INSERT_LOCK_KEY});
          RETURN NEW;
        END;
        $$;
        CREATE TRIGGER block_capability_booking_insert
        BEFORE INSERT ON "${database.schema}".bookings
        FOR EACH ROW
        EXECUTE FUNCTION "${database.schema}".block_capability_booking_insert()
      `);
    });

    afterEach(async () => {
      if (app) await app.close();
      await database.close();
    });

    async function waitForRequestLock(
      applicationName: string,
      prematureOutcome: () => string | null,
    ): Promise<void> {
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        const outcome = prematureOutcome();
        if (outcome) {
          throw new Error(
            `Request settled before reaching the PostgreSQL lock: ${outcome}`,
          );
        }
        const [row] = await database.bootstrap.client<{
          waiting: boolean;
        }[]>`
          SELECT EXISTS (
            SELECT 1
            FROM pg_stat_activity
            WHERE application_name = ${applicationName}
              AND wait_event_type = 'Lock'
          ) AS waiting
        `;
        if (row?.waiting) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(
        `Timed out waiting for PostgreSQL lock on ${applicationName}`,
      );
    }

    async function createRouteApp(applicationName: string) {
      const requestDatabase = database.openConnection(applicationName);
      app = Fastify();
      registerErrorHandler(app);
      app.decorateRequest("verifiedClientIdentity", null);
      app.addHook("onRequest", async (request) => {
        request.verifiedClientIdentity = {
          clientIp: "203.0.113.80",
          requestId: crypto.randomUUID(),
          timestamp: 1_912_000_000,
          idempotencyKey: null,
        };
      });
      app.decorate("services", {
        settings: createSettingsService(
          requestDatabase.db,
          null,
          REQUEST_ENVIRONMENT,
        ),
        bookings: createBookingsService(
          requestDatabase.db,
          REQUEST_CAPABILITIES,
          {
            now: () => new Date("2030-08-10T00:00:00.000Z"),
            customerActionTokenSecret:
              "capability-linearization-customer-token-secret",
            customerManageBaseUrl: "https://yezyy.test",
          },
        ),
        rateLimits: createRateLimitsService(
          createRateLimitsRepository(requestDatabase.db),
          {
            hashSecret:
              "capability-linearization-rate-limit-secret-local-test",
          },
        ),
      } as never);
      await app.register(bookingsRoutes, { prefix: "/bookings" });
    }

    const cases = [
      {
        label: "legacy experience request",
        disabledColumn: "experience" as const,
        payload() {
          return {
            kind: "experience" as const,
            projectId,
            timeSlotId: slotId,
            preferredDate: "2030-08-12",
            numberOfPeople: 2,
            name: "Legacy capability request",
            phone: "0430000000",
            email: "legacy-capability@example.test",
            locale: "en",
          };
        },
      },
      {
        label: "ordinary experience request",
        disabledColumn: "experience" as const,
        payload() {
          return {
            kind: "experience" as const,
            mode: "booking" as const,
            name: "Ordinary capability request",
            phone: "0430000001",
            email: "ordinary-capability@example.test",
            date: "2030-08-12",
            startTime: "10:00",
            participantCount: 2,
            youngChildCount: 0,
            accompanyingAdultCount: 1,
            items: [{ projectId, quantity: 2 }],
            locale: "en" as const,
            policyVersion: "2026-07-29" as const,
            policyAccepted: true as const,
          };
        },
      },
      {
        label: "dedicated party request",
        disabledColumn: "party" as const,
        payload() {
          return {
            kind: "party" as const,
            partyPackageId,
            name: "Party capability request",
            phone: "0430000002",
            email: "party-capability@example.test",
            birthdayChildName: "Kai",
            birthdayChildAge: 6,
            participantCount: 4,
            parentCount: 1 as const,
            desiredDate: "2030-08-12",
            desiredStartTime: "12:00",
            projectInterests: ["clay"],
            byoCake: true,
            byoDrinks: true,
            byoFood: false,
            byoSnacks: true,
            cakeCuttingRequested: true,
            locale: "en" as const,
            policyVersion: "2026-07-29" as const,
            policyAccepted: true as const,
          };
        },
      },
    ];

    it.each(cases)(
      "does not commit $label after a committed database closure",
      async ({ disabledColumn, payload }) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const requestApplicationName = `cap_req_${suffix}`;
        const blockerDatabase = database.openConnection(
          `cap_block_${suffix}`,
        );
        const adminDatabase = database.openConnection(`cap_admin_${suffix}`);
        const releaseInsert = deferred();
        const insertLockReady = deferred();
        const releaseAdmin = deferred();
        const adminUpdateReady = deferred();

        const blockerTransaction = blockerDatabase.db.transaction(
          async (tx) => {
            await tx.execute(
              sql`SELECT pg_advisory_xact_lock(${INSERT_LOCK_CLASS}, ${INSERT_LOCK_KEY})`,
            );
            insertLockReady.resolve();
            await releaseInsert.promise;
          },
        );
        await insertLockReady.promise;

        const adminClosure = adminDatabase.db.transaction(async (tx) => {
          await tx
            .update(siteSettings)
            .set(
              disabledColumn === "experience"
                ? { experienceRequestsEnabled: false }
                : { partyRequestsEnabled: false },
            )
            .where(eq(siteSettings.id, settingsId));
          adminUpdateReady.resolve();
          await releaseAdmin.promise;
        });
        await adminUpdateReady.promise;
        await createRouteApp(requestApplicationName);

        const responsePromise = app.inject({
          method: "POST",
          url: "/bookings",
          headers: { "idempotency-key": crypto.randomUUID() },
          payload: payload(),
        });
        let prematureResponse: string | null = null;
        void responsePromise.then(
          (response) => {
            prematureResponse = `${response.statusCode} ${response.body}`;
          },
          (error: unknown) => {
            prematureResponse = String(error);
          },
        );

        try {
          await waitForRequestLock(
            requestApplicationName,
            () => prematureResponse,
          );
          releaseAdmin.resolve();
          await adminClosure;
          releaseInsert.resolve();
          await blockerTransaction;

          const response = await responsePromise;
          expect(response.statusCode).toBe(503);
          expect(response.json()).toMatchObject({
            success: false,
            error: { code: "REQUEST_FLOW_DISABLED" },
          });
          await expect(
            database.connection.db.select().from(bookings),
          ).resolves.toHaveLength(0);
          await expect(
            database.connection.db.select().from(emailOutbox),
          ).resolves.toHaveLength(0);
          await expect(
            database.connection.db.select().from(requestRateLimits),
          ).resolves.toHaveLength(0);
        } finally {
          releaseAdmin.resolve();
          releaseInsert.resolve();
          await Promise.allSettled([
            adminClosure,
            blockerTransaction,
            responsePromise,
          ]);
        }
      },
      15_000,
    );

    it(
      "makes the admin closure wait for a request that already crossed the linearization point",
      async () => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const requestApplicationName = `cap_req_first_${suffix}`;
        const adminApplicationName = `cap_admin_wait_${suffix}`;
        const blockerDatabase = database.openConnection(
          `cap_block_first_${suffix}`,
        );
        const adminDatabase = database.openConnection(adminApplicationName);
        const releaseInsert = deferred();
        const insertLockReady = deferred();

        const blockerTransaction = blockerDatabase.db.transaction(
          async (tx) => {
            await tx.execute(
              sql`SELECT pg_advisory_xact_lock(${INSERT_LOCK_CLASS}, ${INSERT_LOCK_KEY})`,
            );
            insertLockReady.resolve();
            await releaseInsert.promise;
          },
        );
        await insertLockReady.promise;
        await createRouteApp(requestApplicationName);

        const responsePromise = app.inject({
          method: "POST",
          url: "/bookings",
          headers: { "idempotency-key": crypto.randomUUID() },
          payload: cases[0]!.payload(),
        });
        let prematureResponse: string | null = null;
        void responsePromise.then(
          (response) => {
            prematureResponse = `${response.statusCode} ${response.body}`;
          },
          (error: unknown) => {
            prematureResponse = String(error);
          },
        );

        let prematureAdminOutcome: string | null = null;
        let adminClosure:
          | ReturnType<
              ReturnType<
                typeof createAdminSettingsService
              >["updateRequestSwitches"]
            >
          | undefined;

        try {
          await waitForRequestLock(
            requestApplicationName,
            () => prematureResponse,
          );

          adminClosure = createAdminSettingsService(
            adminDatabase.db,
            null,
            REQUEST_ENVIRONMENT,
          ).updateRequestSwitches({ experience: false });
          void adminClosure.then(
            (switches) => {
              prematureAdminOutcome = JSON.stringify(switches);
            },
            (error: unknown) => {
              prematureAdminOutcome = String(error);
            },
          );
          await waitForRequestLock(
            adminApplicationName,
            () => prematureAdminOutcome,
          );

          releaseInsert.resolve();
          await blockerTransaction;
          const [response, switches] = await Promise.all([
            responsePromise,
            adminClosure,
          ]);

          expect(response.statusCode).toBe(201);
          expect(switches.database.experience).toBe(false);
          await expect(
            database.connection.db.select().from(bookings),
          ).resolves.toHaveLength(1);
          await expect(
            database.connection.db.select().from(requestRateLimits),
          ).resolves.toHaveLength(1);
          const [settings] = await database.connection.db
            .select({
              experienceRequestsEnabled:
                siteSettings.experienceRequestsEnabled,
            })
            .from(siteSettings);
          expect(settings).toEqual({
            experienceRequestsEnabled: false,
          });
        } finally {
          releaseInsert.resolve();
          await Promise.allSettled([
            blockerTransaction,
            responsePromise,
            ...(adminClosure ? [adminClosure] : []),
          ]);
        }
      },
      15_000,
    );

    it("initializes exactly one settings row under concurrent repository upserts", async () => {
      await database.connection.db.delete(siteSettings);
      const suffix = crypto.randomUUID().slice(0, 8);
      const firstRepository = createSettingsRepository(
        database.openConnection(`cap_settings_a_${suffix}`).db,
      );
      const secondRepository = createSettingsRepository(
        database.openConnection(`cap_settings_b_${suffix}`).db,
      );

      const initialized = await Promise.all([
        firstRepository.upsertSingleton({ storeName: "First bootstrap" }),
        secondRepository.upsertSingleton({ storeName: "Second bootstrap" }),
      ]);

      expect(new Set(initialized.map((row) => row.id)).size).toBe(1);
      const persisted = await database.connection.db
        .select()
        .from(siteSettings);
      expect(persisted).toHaveLength(1);
      expect(persisted[0]).toMatchObject({
        id: initialized[0]!.id,
        singletonKey: true,
      });
      await expect(firstRepository.findSingleton()).resolves.toMatchObject({
        id: initialized[0]!.id,
        singletonKey: true,
      });
    });

    it("keeps replay rate limiting in the same transaction without duplicating the booking", async () => {
      await createRouteApp(`cap_replay_${crypto.randomUUID().slice(0, 8)}`);
      const idempotencyKey = crypto.randomUUID();
      const request = {
        method: "POST" as const,
        url: "/bookings",
        headers: { "idempotency-key": idempotencyKey },
        payload: cases[0]!.payload(),
      };

      const first = await app.inject(request);
      const replay = await app.inject(request);

      expect(first.statusCode).toBe(201);
      expect(first.json()).toMatchObject({
        success: true,
        data: { replayed: false },
      });
      expect(replay.statusCode).toBe(201);
      expect(replay.json()).toMatchObject({
        success: true,
        data: { replayed: true },
      });
      await expect(
        database.connection.db.select().from(bookings),
      ).resolves.toHaveLength(1);
      const rateLimits = await database.connection.db
        .select({ requestCount: requestRateLimits.requestCount })
        .from(requestRateLimits);
      expect(rateLimits).toEqual([{ requestCount: 2 }]);
    });
  },
);
