import { cartOrderItems, cartOrders, type Db, type LocalizedString } from "@yezz/db";
import { AppError } from "../../lib/errors.js";
import {
  createCartOrdersRepository,
  type OrderStatus,
} from "../../repositories/cart-orders.repository.js";
import { validateOrderStatus } from "./bookings.admin.service.js";

export type CartOrderItemDto = {
  id: string;
  projectId: string | null;
  projectName: LocalizedString | string | null;
  projectType: "experience" | "product" | null;
  styleName: LocalizedString | string | null;
  date: string | null;
  people: number | null;
  price: string | null;
  sortOrder: number;
};

export type CartOrderDto = {
  id: string;
  name: string;
  phone: string;
  wechat: string | null;
  message: string | null;
  status: OrderStatus;
  items: CartOrderItemDto[];
  createdAt: Date;
  updatedAt: Date;
};

type CartOrderRow = typeof cartOrders.$inferSelect;
type CartOrderItemRow = typeof cartOrderItems.$inferSelect;

function mapItemRow(row: CartOrderItemRow): CartOrderItemDto {
  return {
    id: row.id,
    projectId: row.projectId ?? null,
    projectName: row.projectName ?? null,
    projectType: row.projectType ?? null,
    styleName: row.styleName ?? null,
    date: row.date ?? null,
    people: row.people ?? null,
    price: row.price ?? null,
    sortOrder: row.sortOrder,
  };
}

function mapOrderRow(row: CartOrderRow, items: CartOrderItemRow[]): CartOrderDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    wechat: row.wechat ?? null,
    message: row.message ?? null,
    status: row.status,
    items: items.map(mapItemRow),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type AdminCartOrdersService = ReturnType<typeof createAdminCartOrdersService>;

export function createAdminCartOrdersService(db: Db) {
  const repo = createCartOrdersRepository(db);

  return {
    async list(): Promise<CartOrderDto[]> {
      const orders = await repo.findAllOrdered();
      const items = await repo.findItemsByOrderIds(orders.map((o) => o.id));
      const itemsByOrder = new Map<string, CartOrderItemRow[]>();
      for (const item of items) {
        const list = itemsByOrder.get(item.orderId) ?? [];
        list.push(item);
        itemsByOrder.set(item.orderId, list);
      }
      return orders.map((order) =>
        mapOrderRow(order, itemsByOrder.get(order.id) ?? []),
      );
    },

    async getById(id: string): Promise<CartOrderDto> {
      const order = await repo.findById(id);
      if (!order) {
        throw new AppError(404, "NOT_FOUND", "Cart order not found");
      }
      const items = await repo.findItemsByOrderId(id);
      return mapOrderRow(order, items);
    },

    async updateStatus(id: string, status: OrderStatus): Promise<CartOrderDto> {
      if (!status) {
        throw new AppError(400, "VALIDATION_ERROR", "status is required");
      }
      validateOrderStatus(status);
      const row = await repo.updateStatus(id, status);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Cart order not found");
      }
      const items = await repo.findItemsByOrderId(id);
      return mapOrderRow(row, items);
    },
  };
}
