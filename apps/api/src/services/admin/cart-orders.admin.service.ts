import {
  cartOrderItems,
  cartOrders,
  emailOutbox,
  type Db,
  type LocalizedString,
} from "@yezz/db";
import { desc, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import {
  createCartOrdersRepository,
  type OrderStatus,
} from "../../repositories/cart-orders.repository.js";
import { createStatusEventsRepository } from "../../repositories/status-events.repository.js";
import { createRequestTransitionService } from "../request-transition.service.js";

type DeliveryStatus = "pending" | "processing" | "sent" | "failed";

export type CartOrderItemDto = {
  id: string;
  projectId: string | null;
  styleId: string | null;
  projectName: LocalizedString | string | null;
  projectType: "experience" | "product" | null;
  styleName: LocalizedString | string | null;
  date: string | null;
  people: number | null;
  price: string | null;
  priceCurrency: string;
  sortOrder: number;
};

export type CartOrderStatusHistoryItem = {
  id: string;
  operationId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string;
    email: string;
  };
};

export type CartOrderEmailDelivery = {
  id: string;
  messageType: string;
  recipient: string;
  deliveryStatus: DeliveryStatus;
  attemptCount: number;
  lastError: string | null;
  sentAt: Date | null;
  updatedAt: Date;
};

export type CartOrderDto = {
  id: string;
  name: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  message: string | null;
  preferredDate: string | null;
  numberOfPeople: number | null;
  locale: string | null;
  timeSlotId: string | null;
  slot: {
    id: string | null;
    date: string;
    startTime: string | null;
    endTime: string | null;
    timeZone: string;
  } | null;
  status: OrderStatus;
  items: CartOrderItemDto[];
  notificationSummary: {
    latestStatus: DeliveryStatus | null;
    failedCount: number;
  };
  statusHistory: CartOrderStatusHistoryItem[];
  emailDeliveries: CartOrderEmailDelivery[];
  createdAt: Date;
  updatedAt: Date;
  replayed?: boolean;
};

type CartOrderRow = typeof cartOrders.$inferSelect;
type CartOrderItemRow = typeof cartOrderItems.$inferSelect;
type CartOrderDtoExtras = Pick<
  CartOrderDto,
  "notificationSummary" | "statusHistory" | "emailDeliveries"
>;

const EMPTY_EXTRAS: CartOrderDtoExtras = {
  notificationSummary: {
    latestStatus: null,
    failedCount: 0,
  },
  statusHistory: [],
  emailDeliveries: [],
};

function mapItemRow(row: CartOrderItemRow): CartOrderItemDto {
  return {
    id: row.id,
    projectId: row.projectId ?? null,
    styleId: row.styleId ?? null,
    projectName: row.projectName ?? null,
    projectType: row.projectType ?? null,
    styleName: row.styleName ?? null,
    date: row.date ?? null,
    people: row.people ?? null,
    price: row.price ?? null,
    priceCurrency: row.priceCurrency,
    sortOrder: row.sortOrder,
  };
}

function mapOrderRow(
  row: CartOrderRow,
  items: CartOrderItemRow[],
  extras: CartOrderDtoExtras = EMPTY_EXTRAS,
): CartOrderDto {
  const slot =
    row.slotDate || row.preferredDate
      ? {
          id: row.timeSlotId ?? null,
          date: row.slotDate ?? row.preferredDate!,
          startTime: row.slotStartTime ?? null,
          endTime: row.slotEndTime ?? null,
          timeZone: row.slotTimezone,
        }
      : null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    wechat: row.wechat ?? null,
    email: row.email ?? null,
    message: row.message ?? null,
    preferredDate: row.preferredDate ?? null,
    numberOfPeople: row.numberOfPeople ?? null,
    locale: row.locale ?? null,
    timeSlotId: row.timeSlotId ?? null,
    slot,
    status: row.status,
    items: items.map(mapItemRow),
    notificationSummary: extras.notificationSummary,
    statusHistory: extras.statusHistory,
    emailDeliveries: extras.emailDeliveries,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type AdminCartOrdersService = ReturnType<
  typeof createAdminCartOrdersService
>;

export function createAdminCartOrdersService(db: Db) {
  const repo = createCartOrdersRepository(db);
  const eventsRepo = createStatusEventsRepository(db);
  const transitionService = createRequestTransitionService(db);

  async function loadExtras(
    cartOrderId: string,
    includeHistory: boolean,
  ): Promise<CartOrderDtoExtras> {
    const deliveries = await db
      .select({
        id: emailOutbox.id,
        messageType: emailOutbox.messageType,
        recipient: emailOutbox.recipient,
        deliveryStatus: emailOutbox.deliveryStatus,
        attemptCount: emailOutbox.attemptCount,
        lastError: emailOutbox.lastError,
        sentAt: emailOutbox.sentAt,
        updatedAt: emailOutbox.updatedAt,
      })
      .from(emailOutbox)
      .where(eq(emailOutbox.cartOrderId, cartOrderId))
      .orderBy(desc(emailOutbox.createdAt));
    const history = includeHistory
      ? await eventsRepo.listForCartOrder(cartOrderId)
      : [];
    return {
      emailDeliveries: deliveries as CartOrderEmailDelivery[],
      notificationSummary: {
        latestStatus:
          (deliveries[0]?.deliveryStatus as DeliveryStatus | undefined) ??
          null,
        failedCount: deliveries.filter(
          ({ deliveryStatus }) => deliveryStatus === "failed",
        ).length,
      },
      statusHistory: history.map((event) => ({
        id: event.id,
        operationId: event.operationId,
        fromStatus: event.fromStatus as OrderStatus,
        toStatus: event.toStatus as OrderStatus,
        note: event.note,
        createdAt: event.createdAt,
        actor: {
          id: event.actorId,
          name: event.actorName,
          email: event.actorEmail,
        },
      })),
    };
  }

  async function getById(id: string): Promise<CartOrderDto> {
    const order = await repo.findById(id);
    if (!order) {
      throw new AppError(404, "NOT_FOUND", "Cart order not found");
    }
    const items = await repo.findItemsByOrderId(id);
    return mapOrderRow(order, items, await loadExtras(id, true));
  }

  return {
    async list(options?: {
      page?: number;
      limit?: number;
      status?: OrderStatus;
    }): Promise<{
      data: CartOrderDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }> {
      const page = Math.max(1, options?.page ?? 1);
      const limit = Math.min(200, Math.max(1, options?.limit ?? 25));
      const offset = (page - 1) * limit;
      const { rows, total } = await repo.findAllOrdered({
        limit,
        offset,
        status: options?.status,
      });
      const allItems = await repo.findItemsByOrderIds(
        rows.map((order) => order.id),
      );
      const itemsByOrder = new Map<string, CartOrderItemRow[]>();
      for (const item of allItems) {
        const items = itemsByOrder.get(item.orderId) ?? [];
        items.push(item);
        itemsByOrder.set(item.orderId, items);
      }
      const data = await Promise.all(
        rows.map(async (order) =>
          mapOrderRow(
            order,
            itemsByOrder.get(order.id) ?? [],
            await loadExtras(order.id, false),
          ),
        ),
      );
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },

    getById,

    async updateStatus(
      id: string,
      input: {
        status: OrderStatus;
        expectedStatus: OrderStatus;
        operationId: string;
        note?: string | null;
      },
      actorUserId: string,
    ): Promise<CartOrderDto> {
      if (!input?.status || !input.expectedStatus || !input.operationId) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "status, expectedStatus, and operationId are required",
        );
      }
      const result = await transitionService.transitionCartOrder({
        cartOrderId: id,
        expectedStatus: input.expectedStatus,
        status: input.status,
        operationId: input.operationId,
        actorUserId,
        note: input.note,
      });
      const dto = await getById(result.row.id);
      return { ...dto, replayed: result.replayed };
    },
  };
}
