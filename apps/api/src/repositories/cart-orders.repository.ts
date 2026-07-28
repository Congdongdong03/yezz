import {
  cartOrderItems,
  cartOrders,
  type CartOrderItemSnapshot,
  type Db,
} from "@yezz/db";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { lockPublicCreateAttempt } from "../lib/public-create-idempotency.js";

export type OrderStatus = "new" | "contacted" | "confirmed" | "cancelled";

export type CartOrderCreateInput = {
  name: string;
  phone: string;
  wechat?: string | null;
  email?: string | null;
  message?: string | null;
  timeSlotId?: string | null;
  numberOfPeople?: number | null;
  preferredDate?: string | null;
  locale?: string | null;
  items: CartOrderItemSnapshot[];
};

export type CartOrderInsertInput = CartOrderCreateInput & {
  timeSlotId: string;
  numberOfPeople: number;
  preferredDate: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  slotTimezone: "Australia/Melbourne";
  locale: "en" | "zh";
  idempotencyKey: string;
};

export function createCartOrdersRepository(db: Db) {
  async function insertOrder(input: CartOrderInsertInput, tx: Db) {
    const [order] = await tx
      .insert(cartOrders)
      .values({
        name: input.name.trim(),
        phone: input.phone.trim(),
        wechat: input.wechat?.trim() || null,
        email: input.email?.trim() || null,
        message: input.message?.trim() || null,
        timeSlotId: input.timeSlotId,
        numberOfPeople: input.numberOfPeople,
        preferredDate: input.preferredDate,
        slotDate: input.slotDate,
        slotStartTime: input.slotStartTime,
        slotEndTime: input.slotEndTime,
        slotTimezone: input.slotTimezone,
        locale: input.locale,
        idempotencyKey: input.idempotencyKey,
        updatedAt: new Date(),
      })
      .returning();

    await tx.insert(cartOrderItems).values(
      input.items.map((item, index) => ({
        orderId: order.id,
        projectId: item.projectId || null,
        styleId: item.styleId || null,
        projectName: item.projectName ?? null,
        projectType: item.projectType ?? null,
        styleName: item.styleName ?? null,
        date: item.date?.trim() || null,
        people: item.people ?? null,
        price: item.price?.trim() || null,
        priceCurrency: item.priceCurrency?.trim() || "AUD",
        sortOrder: index,
      })),
    );

    return order;
  }

  return {
    async lockCreateAttempt(idempotencyKey: string, tx: Db = db) {
      await lockPublicCreateAttempt(tx, "cart-order", idempotencyKey);
    },

    async create(input: CartOrderInsertInput, tx?: Db) {
      if (tx) return insertOrder(input, tx);
      return db.transaction((transaction) => insertOrder(input, transaction));
    },

    findAllOrdered() {
      return db.select().from(cartOrders).orderBy(desc(cartOrders.createdAt));
    },

    async findById(id: string, tx: Db = db) {
      const [row] = await tx
        .select()
        .from(cartOrders)
        .where(eq(cartOrders.id, id))
        .limit(1);
      return row ?? null;
    },

    async findByIdempotencyKey(idempotencyKey: string, tx: Db = db) {
      const [row] = await tx
        .select()
        .from(cartOrders)
        .where(eq(cartOrders.idempotencyKey, idempotencyKey))
        .limit(1);
      return row ?? null;
    },

    async findItemsByOrderId(orderId: string, tx: Db = db) {
      return tx
        .select()
        .from(cartOrderItems)
        .where(eq(cartOrderItems.orderId, orderId))
        .orderBy(asc(cartOrderItems.sortOrder));
    },

    async findItemsByOrderIds(orderIds: string[]) {
      if (orderIds.length === 0) return [];
      return db
        .select()
        .from(cartOrderItems)
        .where(inArray(cartOrderItems.orderId, orderIds))
        .orderBy(asc(cartOrderItems.sortOrder));
    },

    async updateStatus(id: string, status: OrderStatus) {
      const [row] = await db
        .update(cartOrders)
        .set({ status, updatedAt: new Date() })
        .where(eq(cartOrders.id, id))
        .returning();
      return row ?? null;
    },
  };
}
