import {
  cartOrderItems,
  cartOrders,
  adminRequestReads,
  type CartOrderItemSnapshot,
  type Db,
} from "@yezz/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
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

    async findAllOrdered(opts: {
      userId: string;
      limit: number;
      offset: number;
      status?: OrderStatus;
      search?: string;
      unreadOnly?: boolean;
      overdue?: boolean;
      confirmedToday?: boolean;
    }) {
      const readJoin = and(
        eq(adminRequestReads.userId, opts.userId),
        eq(adminRequestReads.cartOrderId, cartOrders.id),
      );
      const search = opts.search?.trim();
      const conditions = [
        ...(opts.status ? [eq(cartOrders.status, opts.status)] : []),
        ...(search
          ? [
              or(
                ilike(cartOrders.name, `%${search}%`),
                ilike(cartOrders.phone, `%${search}%`),
                ilike(cartOrders.email, `%${search}%`),
                ilike(cartOrders.wechat, `%${search}%`),
              ),
            ]
          : []),
        ...(opts.unreadOnly ? [isNull(adminRequestReads.userId)] : []),
        ...(opts.overdue
          ? [and(eq(cartOrders.status, "new"), lt(cartOrders.createdAt, new Date(Date.now() - 2 * 60 * 60 * 1000)))]
          : []),
        ...(opts.confirmedToday
          ? [
              and(
                eq(cartOrders.status, "confirmed"),
                sql`(${cartOrders.updatedAt} AT TIME ZONE 'Australia/Melbourne')::date = ((CURRENT_TIMESTAMP AT TIME ZONE 'Australia/Melbourne')::date)`,
              ),
            ]
          : []),
      ];
      const condition = conditions.length ? and(...conditions) : undefined;
      const [totalRow] = await db
        .select({ total: count() })
        .from(cartOrders)
        .leftJoin(adminRequestReads, readJoin)
        .where(condition);
      const rows = await db
        .select({
          row: cartOrders,
          isUnread: sql<boolean>`${adminRequestReads.userId} IS NULL`,
        })
        .from(cartOrders)
        .leftJoin(adminRequestReads, readJoin)
        .where(condition)
        .orderBy(
          sql`CASE WHEN ${cartOrders.status} = 'new' THEN 0 WHEN ${cartOrders.status} = 'contacted' THEN 1 ELSE 2 END`,
          desc(cartOrders.createdAt),
        )
        .limit(opts.limit)
        .offset(opts.offset);
      return { rows, total: Number(totalRow?.total ?? 0) };
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

    async compareAndSetStatus(
      id: string,
      expectedStatus: OrderStatus,
      status: OrderStatus,
      tx: Db = db,
    ) {
      const [row] = await tx
        .update(cartOrders)
        .set({ status, updatedAt: new Date() })
        .where(
          and(
            eq(cartOrders.id, id),
            eq(cartOrders.status, expectedStatus),
          ),
        )
        .returning();
      return row ?? null;
    },
  };
}
