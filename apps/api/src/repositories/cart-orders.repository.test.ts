import {
  cartOrderItems,
  cartOrders,
  diyProjects,
  projectCategories,
  projectStyles,
  timeSlots,
} from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createCartOrdersRepository } from "./cart-orders.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("cart-orders repository PostgreSQL", () => {
  let database: RequestFlowTestDatabase;
  let projectId: string;
  let styleId: string;
  let slotId: string;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    const categoryId = crypto.randomUUID();
    projectId = crypto.randomUUID();
    styleId = crypto.randomUUID();
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
      priceCurrency: "AUD",
    });
    await database.connection.db.insert(projectStyles).values({
      id: styleId,
      projectId,
      name: { en: "Pink", zh: "粉色" },
      price: "$49",
    });
    await database.connection.db.insert(timeSlots).values({
      id: slotId,
      date: "2030-08-12",
      startTime: "10:00",
      endTime: "11:00",
      capacity: 2,
    });
  });

  afterEach(async () => {
    await database.close();
  });

  function validInsert() {
    return {
      name: "Alice",
      phone: "0430000000",
      email: "alice@example.com",
      timeSlotId: slotId,
      numberOfPeople: 2,
      preferredDate: "2030-08-12",
      slotDate: "2030-08-12",
      slotStartTime: "10:00",
      slotEndTime: "11:00",
      slotTimezone: "Australia/Melbourne" as const,
      locale: "en" as const,
      idempotencyKey: crypto.randomUUID(),
      items: [
        {
          projectId,
          styleId,
          projectName: { en: "Phone case", zh: "手机壳" },
          projectType: "product" as const,
          styleName: { en: "Pink", zh: "粉色" },
          price: "$49",
          priceCurrency: "AUD",
        },
      ],
    };
  }

  it("persists and resolves the idempotency row with its exact item snapshots", async () => {
    const repository = createCartOrdersRepository(database.connection.db);
    const input = validInsert();

    const created = await repository.create(input);
    const replay = await repository.findByIdempotencyKey(input.idempotencyKey);
    const items = await repository.findItemsByOrderId(created.id);

    expect(replay?.id).toBe(created.id);
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
  });

  it("rolls back the order when an item insert fails", async () => {
    const repository = createCartOrdersRepository(database.connection.db);
    const input = validInsert();
    input.items[0]!.projectId = crypto.randomUUID();

    await expect(repository.create(input)).rejects.toBeDefined();
    expect(await database.connection.db.select().from(cartOrders)).toHaveLength(
      0,
    );
    expect(
      await database.connection.db.select().from(cartOrderItems),
    ).toHaveLength(0);
  });
});
