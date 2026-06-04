import {
  cartOrderItems,
  cartOrders,
  type CartOrderItemSnapshot,
  type Db,
} from "@yezz/db";

export type CartOrderCreateInput = {
  name: string;
  phone: string;
  wechat?: string | null;
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
  };
}
