import {
  cartOrderItems,
  cartOrders,
  diyProjects,
  emailOutbox,
  projectCategories,
  projectStyles,
  timeSlots,
} from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createCartOrdersService } from "./cart-orders.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";
const enabledCapabilities = {
  experience: true,
  product: true,
  party: true,
} as const;

function createEnabledCartOrdersService(
  db: Parameters<typeof createCartOrdersService>[0],
) {
  return createCartOrdersService(db, enabledCapabilities);
}

describe("cart-order capability", () => {
  it("rejects a disabled product request before database work", async () => {
    const service = createCartOrdersService({} as never, {
      experience: true,
      product: false,
      party: true,
    });

    await expect(
      service.create(
        {
          name: "Capability test",
          phone: "0430000000",
          email: "capability@closure.test",
          timeSlotId: "10000000-0000-4000-8000-000000000001",
          numberOfPeople: 1,
          items: [
            { projectId: "10000000-0000-4000-8000-000000000002" },
          ],
        },
        "10000000-0000-4000-8000-000000000003",
      ),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "REQUEST_FLOW_DISABLED",
    });
  });
});

describe.skipIf(!runDatabaseTests)(
  "cart-order PostgreSQL create idempotency",
  () => {
    let database: RequestFlowTestDatabase;
    let projectId: string;
    let styleId: string;
    let otherProjectId: string;
    let otherStyleId: string;
    let slotId: string;
    const previousOwnerEmail = process.env.OWNER_EMAIL;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
      process.env.OWNER_EMAIL = "owner@example.com";
      const categoryId = crypto.randomUUID();
      projectId = crypto.randomUUID();
      styleId = crypto.randomUUID();
      otherProjectId = crypto.randomUUID();
      otherStyleId = crypto.randomUUID();
      slotId = crypto.randomUUID();
      await database.connection.db.insert(projectCategories).values({
        id: categoryId,
        name: { en: "Products", zh: "产品" },
        slug: `products-${categoryId}`,
      });
      await database.connection.db.insert(diyProjects).values({
        id: projectId,
        categoryId,
        name: { en: "Phone case", zh: "手机壳" },
        slug: `phone-case-${projectId}`,
        projectType: "product",
        priceRange: "From $43",
        priceCurrency: "AUD",
      });
      await database.connection.db.insert(diyProjects).values({
        id: otherProjectId,
        categoryId,
        name: { en: "Lamp", zh: "台灯" },
        slug: `lamp-${otherProjectId}`,
        projectType: "product",
        priceRange: "From $55",
        priceCurrency: "AUD",
      });
      await database.connection.db.insert(projectStyles).values({
        id: styleId,
        projectId,
        name: { en: "Pink", zh: "粉色" },
        price: "$49",
      });
      await database.connection.db.insert(projectStyles).values({
        id: otherStyleId,
        projectId: otherProjectId,
        name: { en: "Blue", zh: "蓝色" },
        price: "$59",
      });
      await database.connection.db.insert(timeSlots).values({
        id: slotId,
        date: "2030-08-12",
        startTime: "10:00",
        endTime: "11:00",
        capacity: 2,
        categoryId: null,
      });
    });

    afterEach(async () => {
      if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
      else process.env.OWNER_EMAIL = previousOwnerEmail;
      await database.close();
    });

    function validCart() {
      return {
        name: "Alice",
        phone: "0430000000",
        email: "alice@example.com",
        timeSlotId: slotId,
        numberOfPeople: 2,
        preferredDate: "2030-08-12",
        locale: "en",
        items: [{ projectId, styleId }],
      };
    }

    it("returns one resource and queues no extra effects for an identical replay", async () => {
      const service = createEnabledCartOrdersService(database.connection.db);
      const idempotencyKey = crypto.randomUUID();

      const created = await service.create(validCart(), idempotencyKey);
      const replayed = await service.create(validCart(), idempotencyKey);
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      const items = await database.connection.db.select().from(cartOrderItems);
      const deliveries = await database.connection.db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.cartOrderId, created.id));

      expect(created).toMatchObject({
        status: "new",
        replayed: false,
        notification: "queued",
      });
      expect(replayed).toMatchObject({
        id: created.id,
        status: "new",
        replayed: true,
        notification: "queued",
      });
      expect(slot.bookedCount).toBe(2);
      expect(await database.connection.db.select().from(cartOrders)).toHaveLength(1);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        orderId: created.id,
        projectId,
        styleId,
        projectName: { en: "Phone case", zh: "手机壳" },
        projectType: "product",
        styleName: { en: "Pink", zh: "粉色" },
        price: "$49",
        priceCurrency: "AUD",
      });
      expect(deliveries).toHaveLength(2);
    });

    it("rejects a style that belongs to another authoritative product", async () => {
      const service = createEnabledCartOrdersService(database.connection.db);

      await expect(
        service.create(
          {
            ...validCart(),
            items: [{ projectId, styleId: otherStyleId }],
          },
          crypto.randomUUID(),
        ),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: "STYLE_PROJECT_MISMATCH",
      });

      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));
      expect(slot.bookedCount).toBe(0);
      expect(
        await database.connection.db.select().from(cartOrders),
      ).toHaveLength(0);
      expect(
        await database.connection.db.select().from(emailOutbox),
      ).toHaveLength(0);
    });

    it("serializes concurrent retries at exact capacity into one create and one replay", async () => {
      const idempotencyKey = crypto.randomUUID();
      const first = createEnabledCartOrdersService(database.connection.db);
      const second = createEnabledCartOrdersService(database.connection.db);

      const results = await Promise.all([
        first.create(validCart(), idempotencyKey),
        second.create(validCart(), idempotencyKey),
      ]);
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));

      expect([...new Set(results.map(({ id }) => id))]).toHaveLength(1);
      expect(results.map(({ replayed }) => replayed).sort()).toEqual([
        false,
        true,
      ]);
      expect(slot.bookedCount).toBe(2);
      expect(await database.connection.db.select().from(cartOrders)).toHaveLength(1);
      expect(await database.connection.db.select().from(cartOrderItems)).toHaveLength(1);
      expect(await database.connection.db.select().from(emailOutbox)).toHaveLength(2);
    });

    it("returns safe 409 for a different canonical payload without extra effects", async () => {
      const service = createEnabledCartOrdersService(database.connection.db);
      const idempotencyKey = crypto.randomUUID();
      const created = await service.create(validCart(), idempotencyKey);

      await expect(
        service.create(
          { ...validCart(), email: "other@example.com" },
          idempotencyKey,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "IDEMPOTENCY_KEY_CONFLICT",
      });
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));

      expect(created.replayed).toBe(false);
      expect(slot.bookedCount).toBe(2);
      expect(await database.connection.db.select().from(cartOrders)).toHaveLength(1);
      expect(await database.connection.db.select().from(cartOrderItems)).toHaveLength(1);
      expect(await database.connection.db.select().from(emailOutbox)).toHaveLength(2);
    });

    it("lets one concurrent payload own the key and rejects the other without extra effects", async () => {
      const idempotencyKey = crypto.randomUUID();
      const first = createEnabledCartOrdersService(database.connection.db);
      const second = createEnabledCartOrdersService(database.connection.db);

      const results = await Promise.allSettled([
        first.create(validCart(), idempotencyKey),
        second.create(
          { ...validCart(), email: "other@example.com" },
          idempotencyKey,
        ),
      ]);
      const [slot] = await database.connection.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId));

      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(results.filter(({ status }) => status === "rejected")).toMatchObject([
        {
          reason: {
            statusCode: 409,
            code: "IDEMPOTENCY_KEY_CONFLICT",
          },
        },
      ]);
      expect(slot.bookedCount).toBe(2);
      expect(await database.connection.db.select().from(cartOrders)).toHaveLength(1);
      expect(await database.connection.db.select().from(cartOrderItems)).toHaveLength(1);
      expect(await database.connection.db.select().from(emailOutbox)).toHaveLength(2);
    });
  },
);
