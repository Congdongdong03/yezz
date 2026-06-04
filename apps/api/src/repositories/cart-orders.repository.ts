import {
  cartOrderItems,
  cartOrders,
  type CartOrderItemSnapshot,
  type Db,
} from "@yezz/db";
import { asc, desc, eq, inArray } from "drizzle-orm";

export type OrderStatus = "new" | "contacted" | "confirmed" | "cancelled";

export type CartOrderCreateInput = {
  name: string;
  phone: string;
  wechat?: string | null;
  email?: string | null;
  message?: string | null;
  items: CartOrderItemSnapshot[];
};

export function createCartOrdersRepository(db: Db) {
  return {
    async create(input: CartOrderCreateInput) {
      return db.transaction(async (tx) => {
        const [order] = await tx
          .insert(cartOrders)
          .values({
            name: input.name.trim(),
            phone: input.phone.trim(),
            wechat: input.wechat?.trim() || null,
            email: input.email?.trim() || null,
            message: input.message?.trim() || null,
            updatedAt: new Date(),
          })
          .returning();

        if (input.items.length > 0) {
          await tx.insert(cartOrderItems).values(
            input.items.map((item, index) => ({
              orderId: order.id,
              projectId: item.projectId || null,
              projectName: item.projectName ?? null,
              projectType: item.projectType ?? null,
              styleName: item.styleName ?? null,
              date: item.date?.trim() || null,
              people: item.people ?? null,
              price: item.price?.trim() || null,
              sortOrder: index,
            })),
          );
        }

        return order;
      });
    },

    findAllOrdered() {
      return db.select().from(cartOrders).orderBy(desc(cartOrders.createdAt));
    },

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(cartOrders)
        .where(eq(cartOrders.id, id))
        .limit(1);
      return row ?? null;
    },

    async findItemsByOrderId(orderId: string) {
      return db
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
