import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterEach, describe, expect, it } from "vitest";
import { createEmailOutboxRepository } from "./email-outbox.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_REPOSITORY_TESTS === "1";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const migrationsDirectory = fileURLToPath(
  new URL("../../../../packages/db/migrations/", import.meta.url),
);

function requireSafeTestDatabaseUrl(): string {
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required when YEZYY_RUN_DB_REPOSITORY_TESTS=1",
    );
  }
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error(
      "Repository tests refuse TEST_DATABASE_URL when it equals DATABASE_URL",
    );
  }
  const databaseName = decodeURIComponent(
    new URL(testDatabaseUrl).pathname.slice(1),
  );
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(
      `Repository tests refuse database "${databaseName}"; its name must include test, local, or dev`,
    );
  }
  return testDatabaseUrl;
}

let adminClient: Sql | undefined;
const generatedSchemas: string[] = [];

async function applyMigrations(client: Sql, schema: string) {
  for (const name of [
    "0000_ordinary_captain_britain.sql",
    "0001_nice_ezekiel.sql",
    "0002_yezyy_flow_closure.sql",
  ]) {
    const contents = (
      await readFile(`${migrationsDirectory}${name}`, "utf8")
    ).replaceAll('"public".', `"${schema}".`);
    for (const statement of contents
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean)) {
      await client.unsafe(`SET search_path TO "${schema}"`);
      await client.unsafe(statement);
    }
  }
}

async function setupRepository() {
  const url = requireSafeTestDatabaseUrl();
  adminClient = postgres(url, { max: 1 });
  const schema = `yezyy_outbox_test_${crypto.randomUUID().replaceAll("-", "")}`;
  generatedSchemas.push(schema);
  await adminClient.unsafe(`CREATE SCHEMA "${schema}"`);
  await applyMigrations(adminClient, schema);

  const client = postgres(url, {
    max: 4,
    connection: { search_path: schema },
  });
  const db = drizzle(client);
  const [booking] = await client<{ id: string }[]>`
    INSERT INTO bookings (name, phone)
    VALUES ('Queue Customer', '0430000000')
    RETURNING id
  `;
  return {
    bookingId: booking.id,
    client,
    repo: createEmailOutboxRepository(db as never),
  };
}

function bookingReceivedPayload(
  bookingId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    template: "booking_received",
    storeName: "YezYY",
    orderId: bookingId,
    orderNumber: "booking-20260728-1234",
    submittedAt: "2026-07-28T02:00:00.000Z",
    input: {
      name: "Queue Customer",
      phone: "0430000000",
      locale: "en",
    },
    contact: {
      email: "congdongdong03@gmail.com",
      phone: "0430 787 712",
    },
    ...overrides,
  };
}

function statusPayload(
  status: "contacted" | "confirmed" | "cancelled",
  orderNumber = "booking-20260728-1234",
) {
  return {
    template: "booking_status",
    status,
    customerName: "Queue Customer",
    orderNumber,
    storeName: "YezYY",
    contact: {
      email: "congdongdong03@gmail.com",
      phone: "0430 787 712",
    },
  };
}

async function insertActor(client: Sql) {
  const [actor] = await client<{ id: string }[]>`
    INSERT INTO users (email, password_hash, name)
    VALUES (
      ${`admin-${crypto.randomUUID()}@example.test`},
      'not-a-real-hash',
      'Test Admin'
    )
    RETURNING id
  `;
  return actor.id;
}

async function insertBooking(client: Sql, name: string, phone: string) {
  const [booking] = await client<{ id: string }[]>`
    INSERT INTO bookings (name, phone)
    VALUES (${name}, ${phone})
    RETURNING id
  `;
  return booking.id;
}

async function insertCartOrder(client: Sql, name: string, phone: string) {
  const [order] = await client<{ id: string }[]>`
    INSERT INTO cart_orders (name, phone)
    VALUES (${name}, ${phone})
    RETURNING id
  `;
  return order.id;
}

async function insertStatusEvent(
  client: Sql,
  input: {
    actorUserId: string;
    bookingId?: string;
    cartOrderId?: string;
    toStatus: "contacted" | "confirmed" | "cancelled";
  },
) {
  const [event] = await client<{ id: string }[]>`
    INSERT INTO request_status_events (
      booking_id,
      cart_order_id,
      operation_id,
      from_status,
      to_status,
      actor_user_id
    )
    VALUES (
      ${input.bookingId ?? null},
      ${input.cartOrderId ?? null},
      ${crypto.randomUUID()},
      'new',
      ${input.toStatus},
      ${input.actorUserId}
    )
    RETURNING id
  `;
  return event.id;
}

afterEach(async () => {
  if (!adminClient) return;
  for (const schema of generatedSchemas.splice(0)) {
    await adminClient.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
  await adminClient.end();
  adminClient = undefined;
});

describe.skipIf(!runDatabaseTests)(
  "email outbox repository PostgreSQL concurrency",
  () => {
    it("deduplicates the same business message", async () => {
      const { bookingId, client, repo } = await setupRepository();
      const message = {
        dedupeKey: "booking:1:received:customer",
        bookingId,
        messageType: "booking_received_customer",
        recipient: "customer@example.test",
        locale: "en",
        payload: bookingReceivedPayload(bookingId),
      };

      const first = await repo.enqueue(message);
      const second = await repo.enqueue(message);

      expect(second.id).toBe(first.id);
      await client.end();
    });

    it("returns the existing dedupe row only when its immutable content matches canonically", async () => {
      const { bookingId, client, repo } = await setupRepository();
      const message = {
        dedupeKey: "booking:1:canonical:customer",
        bookingId,
        messageType: "booking_received_customer",
        recipient: "customer@example.test",
        locale: "en",
        payload: bookingReceivedPayload(bookingId),
      };
      const first = await repo.enqueue(message);

      const sameContentDifferentKeyOrder = await repo.enqueue({
        ...message,
        payload: {
          contact: {
            email: "congdongdong03@gmail.com",
            phone: "0430 787 712",
          },
          input: {
            locale: "en",
            phone: "0430000000",
            name: "Queue Customer",
          },
          submittedAt: "2026-07-28T02:00:00.000Z",
          orderNumber: "booking-20260728-1234",
          orderId: bookingId,
          storeName: "YezYY",
          template: "booking_received",
        },
      });
      expect(sameContentDifferentKeyOrder.id).toBe(first.id);

      await expect(
        repo.enqueue({
          ...message,
          recipient: "different@example.test",
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DEDUPE_CONFLICT" });
      await expect(
        repo.enqueue({
          ...message,
          payload: bookingReceivedPayload(bookingId, {
            orderNumber: "booking-20260728-DIFFERENT",
          }),
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DEDUPE_CONFLICT" });

      const [otherBooking] = await client<{ id: string }[]>`
        INSERT INTO bookings (name, phone)
        VALUES ('Other Customer', '0430000001')
        RETURNING id
      `;
      await expect(
        repo.enqueue({
          ...message,
          bookingId: otherBooking.id,
          payload: bookingReceivedPayload(otherBooking.id),
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DEDUPE_CONFLICT" });

      await expect(
        repo.enqueue({
          ...message,
          locale: "zh",
          payload: bookingReceivedPayload(bookingId, {
            input: {
              name: "Queue Customer",
              phone: "0430000000",
              locale: "zh",
            },
          }),
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DEDUPE_CONFLICT" });

      await expect(
        repo.enqueue({
          ...message,
          messageType: "booking_received_owner",
          payload: {
            template: "owner_request",
            subject: "New booking",
            heading: "Booking details",
            fields: [{ label: "Name", value: "Queue Customer" }],
          },
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DEDUPE_CONFLICT" });

      const [cartOrder] = await client<{ id: string }[]>`
        INSERT INTO cart_orders (name, phone)
        VALUES ('Cart Customer', '0430000002')
        RETURNING id
      `;
      await expect(
        repo.enqueue({
          ...message,
          bookingId: null,
          cartOrderId: cartOrder.id,
          messageType: "cart_order_received_customer",
          payload: {
            template: "cart_order_received",
            orderNumber: "cart-20260728-1234",
            submittedAt: "2026-07-28T02:00:00.000Z",
            input: {
              name: "Cart Customer",
              phone: "0430000002",
              items: [
                {
                  projectName: { en: "Paint Clay Figurine", zh: "彩绘公仔" },
                  projectType: "experience",
                  people: 1,
                  price: "$43",
                },
              ],
            },
            contact: { email: "congdongdong03@gmail.com" },
          },
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DEDUPE_CONFLICT" });

      const actorUserId = await insertActor(client);
      const events = await client<{ id: string }[]>`
        INSERT INTO request_status_events (
          booking_id,
          operation_id,
          from_status,
          to_status,
          actor_user_id
        )
        VALUES
          (${bookingId}, ${crypto.randomUUID()}, 'new', 'contacted', ${actorUserId}),
          (${bookingId}, ${crypto.randomUUID()}, 'new', 'contacted', ${actorUserId})
        RETURNING id
      `;
      const statusMessage = {
        dedupeKey: "booking:1:status:customer",
        bookingId,
        statusEventId: events[0].id,
        messageType: "booking_status_customer",
        recipient: "customer@example.test",
        locale: "en",
        payload: statusPayload("contacted"),
      };
      await repo.enqueue(statusMessage);
      await expect(
        repo.enqueue({
          ...statusMessage,
          statusEventId: events[1].id,
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DEDUPE_CONFLICT" });
      await client.end();
    });

    it("rejects new booking status mail for a cross-booking event or mismatched final status", async () => {
      const { bookingId, client, repo } = await setupRepository();
      const actorUserId = await insertActor(client);
      const otherBookingId = await insertBooking(
        client,
        "Other Booking",
        "0430000011",
      );
      const otherBookingEventId = await insertStatusEvent(client, {
        actorUserId,
        bookingId: otherBookingId,
        toStatus: "contacted",
      });
      const confirmedEventId = await insertStatusEvent(client, {
        actorUserId,
        bookingId,
        toStatus: "confirmed",
      });

      await expect(
        repo.enqueue({
          dedupeKey: "booking:new:cross-parent:customer",
          bookingId,
          statusEventId: otherBookingEventId,
          messageType: "booking_status_customer",
          recipient: "customer@example.test",
          locale: "en",
          payload: statusPayload("contacted"),
        }),
      ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });
      await expect(
        repo.enqueue({
          dedupeKey: "booking:new:status-mismatch:customer",
          bookingId,
          statusEventId: confirmedEventId,
          messageType: "booking_status_customer",
          recipient: "customer@example.test",
          locale: "en",
          payload: statusPayload("contacted"),
        }),
      ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });
      await expect(
        repo.enqueue({
          dedupeKey: "booking:new:malformed-event:customer",
          bookingId,
          statusEventId: "not-a-uuid",
          messageType: "booking_status_customer",
          recipient: "customer@example.test",
          locale: "en",
          payload: statusPayload("contacted"),
        }),
      ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });

      const [count] = await client<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM email_outbox
        WHERE dedupe_key IN (
          'booking:new:cross-parent:customer',
          'booking:new:status-mismatch:customer',
          'booking:new:malformed-event:customer'
        )
      `;
      expect(count.count).toBe(0);
      await client.end();
    });

    it("validates booking event integrity before resolving an existing dedupe key", async () => {
      const { bookingId, client, repo } = await setupRepository();
      const actorUserId = await insertActor(client);
      const contactedEventId = await insertStatusEvent(client, {
        actorUserId,
        bookingId,
        toStatus: "contacted",
      });
      const confirmedEventId = await insertStatusEvent(client, {
        actorUserId,
        bookingId,
        toStatus: "confirmed",
      });
      const message = {
        dedupeKey: "booking:existing:status:customer",
        bookingId,
        statusEventId: contactedEventId,
        messageType: "booking_status_customer",
        recipient: "customer@example.test",
        locale: "en",
        payload: statusPayload("contacted"),
      };
      const existing = await repo.enqueue(message);

      await expect(
        repo.enqueue({
          ...message,
          statusEventId: confirmedEventId,
        }),
      ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });
      await expect(
        repo.enqueue({
          ...message,
          statusEventId: confirmedEventId,
          payload: statusPayload("confirmed"),
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DEDUPE_CONFLICT" });
      expect((await repo.findById(existing.id))?.statusEventId).toBe(
        contactedEventId,
      );
      await client.end();
    });

    it("rejects new cart status mail for a cross-order event or mismatched final status", async () => {
      const { client, repo } = await setupRepository();
      const actorUserId = await insertActor(client);
      const cartOrderId = await insertCartOrder(
        client,
        "Cart Customer",
        "0430000021",
      );
      const otherCartOrderId = await insertCartOrder(
        client,
        "Other Cart Customer",
        "0430000022",
      );
      const otherOrderEventId = await insertStatusEvent(client, {
        actorUserId,
        cartOrderId: otherCartOrderId,
        toStatus: "contacted",
      });
      const cancelledEventId = await insertStatusEvent(client, {
        actorUserId,
        cartOrderId,
        toStatus: "cancelled",
      });

      await expect(
        repo.enqueue({
          dedupeKey: "cart:new:cross-parent:customer",
          cartOrderId,
          statusEventId: otherOrderEventId,
          messageType: "cart_order_status_customer",
          recipient: "customer@example.test",
          locale: "en",
          payload: statusPayload("contacted", "cart-20260728-1234"),
        }),
      ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });
      await expect(
        repo.enqueue({
          dedupeKey: "cart:new:status-mismatch:customer",
          cartOrderId,
          statusEventId: cancelledEventId,
          messageType: "cart_order_status_customer",
          recipient: "customer@example.test",
          locale: "en",
          payload: statusPayload("contacted", "cart-20260728-1234"),
        }),
      ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });

      const [count] = await client<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM email_outbox
        WHERE dedupe_key IN (
          'cart:new:cross-parent:customer',
          'cart:new:status-mismatch:customer'
        )
      `;
      expect(count.count).toBe(0);
      await client.end();
    });

    it("validates cart event integrity before resolving an existing dedupe key", async () => {
      const { client, repo } = await setupRepository();
      const actorUserId = await insertActor(client);
      const cartOrderId = await insertCartOrder(
        client,
        "Cart Customer",
        "0430000031",
      );
      const contactedEventId = await insertStatusEvent(client, {
        actorUserId,
        cartOrderId,
        toStatus: "contacted",
      });
      const cancelledEventId = await insertStatusEvent(client, {
        actorUserId,
        cartOrderId,
        toStatus: "cancelled",
      });
      const message = {
        dedupeKey: "cart:existing:status:customer",
        cartOrderId,
        statusEventId: contactedEventId,
        messageType: "cart_order_status_customer",
        recipient: "customer@example.test",
        locale: "en",
        payload: statusPayload("contacted", "cart-20260728-5678"),
      };
      const existing = await repo.enqueue(message);

      await expect(
        repo.enqueue({
          ...message,
          statusEventId: cancelledEventId,
        }),
      ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });
      await expect(
        repo.enqueue({
          ...message,
          statusEventId: cancelledEventId,
          payload: statusPayload("cancelled", "cart-20260728-5678"),
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DEDUPE_CONFLICT" });
      expect((await repo.findById(existing.id))?.statusEventId).toBe(
        contactedEventId,
      );
      await client.end();
    });

    it("rejects a template that does not match its parent and message type before insert", async () => {
      const { bookingId, client, repo } = await setupRepository();

      await expect(
        repo.enqueue({
          dedupeKey: "booking:1:wrong-template:customer",
          bookingId,
          messageType: "cart_order_received_customer",
          recipient: "customer@example.test",
          locale: "en",
          payload: bookingReceivedPayload(bookingId),
        }),
      ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });

      const [count] = await client<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM email_outbox
        WHERE dedupe_key = 'booking:1:wrong-template:customer'
      `;
      expect(count.count).toBe(0);
      await client.end();
    });

    it("lets concurrent workers claim different rows", async () => {
      const { bookingId, client, repo } = await setupRepository();
      for (const suffix of ["one", "two"]) {
        await repo.enqueue({
          dedupeKey: `booking:1:${suffix}:customer`,
          bookingId,
          messageType: "booking_received_customer",
          recipient: `${suffix}@example.test`,
          locale: "en",
          payload: bookingReceivedPayload(bookingId, {
            orderNumber: `booking-20260728-${suffix}`,
          }),
        });
      }

      const now = new Date("2099-07-28T02:00:00.000Z");
      const [one, two] = await Promise.all([
        repo.claimDue(1, now),
        repo.claimDue(1, now),
      ]);

      expect(one).toHaveLength(1);
      expect(two).toHaveLength(1);
      expect(one[0].id).not.toBe(two[0].id);
      await client.end();
    });

    it("recovers a processing row after its lease expires", async () => {
      const { bookingId, client, repo } = await setupRepository();
      const queued = await repo.enqueue({
        dedupeKey: "booking:1:lease:customer",
        bookingId,
        messageType: "booking_received_customer",
        recipient: "lease@example.test",
        locale: "en",
        payload: bookingReceivedPayload(bookingId, {
          orderNumber: "booking-20260728-LEASE",
        }),
      });
      const first = await repo.claimDue(
        1,
        new Date("2099-07-28T02:00:00.000Z"),
      );
      expect(first[0].id).toBe(queued.id);

      expect(
        await repo.claimDue(1, new Date("2099-07-28T02:04:59.000Z")),
      ).toHaveLength(0);
      expect(
        await repo.claimDue(1, new Date("2099-07-28T02:05:00.000Z")),
      ).toHaveLength(1);
      await client.end();
    });
  },
);
