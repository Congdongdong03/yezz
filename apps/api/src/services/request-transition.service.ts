import type { Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import {
  bookingStatusFromLegacyStatus,
  legacyStatusFromBookingStatus,
  legacyStatusFromBookingEvidence,
} from "../lib/legacy-booking-status.js";
import {
  formatBookingOrderId,
  formatCartOrderId,
  type StoreContact,
} from "../lib/email.js";
import {
  createBookingsRepository,
  type OrderStatus,
} from "../repositories/bookings.repository.js";
import { createCartOrdersRepository } from "../repositories/cart-orders.repository.js";
import { createEmailOutboxRepository } from "../repositories/email-outbox.repository.js";
import { createRequestCapacityRepository } from "../repositories/request-capacity.repository.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import { createStatusEventsRepository } from "../repositories/status-events.repository.js";
import { reservedPeopleForBooking } from "./bookings.service.js";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "contacted",
  "confirmed",
  "cancelled",
];

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["contacted", "confirmed", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
};

export type BookingTransitionInput = {
  bookingId: string;
  expectedStatus: OrderStatus;
  status: OrderStatus;
  operationId: string;
  actorUserId: string;
  note?: string | null;
};

export type CartOrderTransitionInput = {
  cartOrderId: string;
  expectedStatus: OrderStatus;
  status: OrderStatus;
  operationId: string;
  actorUserId: string;
  note?: string | null;
};

function assertUuid(value: string, field: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a UUID`);
  }
  return value.toLowerCase();
}

export function validateOrderStatus(
  status: string,
): asserts status is OrderStatus {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `status must be one of: ${ORDER_STATUSES.join(", ")}`,
    );
  }
}

export function validateStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      400,
      "INVALID_TRANSITION",
      `Cannot transition from "${from}" to "${to}"`,
    );
  }
}

function normalizeNote(note: string | null | undefined): string | null {
  return note?.trim() || null;
}

async function loadStoreContext(db: Db) {
  const row = await createSettingsRepository(db).findSingleton();
  const contact: StoreContact = {
    phone: row?.phone,
    wechatId: row?.wechatId,
    email: row?.email,
  };
  return {
    storeName: row?.storeName || "YezYY Studio",
    address: row?.address ?? null,
    businessHours: row?.businessHours ?? null,
    contact,
  };
}

export function createRequestTransitionService(db: Db) {
  const bookingsRepo = createBookingsRepository(db);
  const cartOrdersRepo = createCartOrdersRepository(db);
  const statusEventsRepo = createStatusEventsRepository(db);
  const capacityRepo = createRequestCapacityRepository(db);
  const outboxRepo = createEmailOutboxRepository(db);

  return {
    async transitionBooking(input: BookingTransitionInput) {
      validateOrderStatus(input.expectedStatus);
      validateOrderStatus(input.status);
      validateStatusTransition(input.expectedStatus, input.status);
      const bookingId = assertUuid(input.bookingId, "bookingId");
      const operationId = assertUuid(input.operationId, "operationId");
      const actorUserId = assertUuid(input.actorUserId, "actorUserId");
      const note = normalizeNote(input.note);

      return db.transaction(async (tx) => {
        await statusEventsRepo.lockOperation(operationId, tx);
        const priorEvent = await statusEventsRepo.findByOperationId(
          operationId,
          tx,
        );
        if (priorEvent) {
          if (
            priorEvent.bookingId !== bookingId ||
            priorEvent.fromStatus !== input.expectedStatus ||
            priorEvent.toStatus !== input.status ||
            priorEvent.actorUserId !== actorUserId ||
            normalizeNote(priorEvent.adminNote) !== note
          ) {
            throw new AppError(
              409,
              "OPERATION_ID_CONFLICT",
              "The operation ID belongs to a different status change",
            );
          }
          const replayedBooking = await bookingsRepo.findById(bookingId, tx);
          if (!replayedBooking) {
            throw new AppError(404, "NOT_FOUND", "Booking not found");
          }
          return {
            row: replayedBooking,
            eventId: priorEvent.id,
            replayed: true,
          };
        }

        const existing = await bookingsRepo.findById(bookingId, tx);
        if (!existing) {
          throw new AppError(404, "NOT_FOUND", "Booking not found");
        }
        const latestTransition = await statusEventsRepo.findLatestForBooking(
          bookingId,
          tx,
        );
        const currentStatus = legacyStatusFromBookingEvidence(
          existing.status,
          latestTransition?.toStatus,
        );
        if (currentStatus !== input.expectedStatus) {
          throw new AppError(
            409,
            "STATUS_CONFLICT",
            "The request changed. Refresh and try again.",
            { currentStatus },
          );
        }

        const updated = await bookingsRepo.compareAndSetStatus(
          bookingId,
          input.expectedStatus,
          input.status,
          tx,
        );
        if (!updated) {
          const current = await bookingsRepo.findById(bookingId, tx);
          const currentTransition = current
            ? await statusEventsRepo.findLatestForBooking(bookingId, tx)
            : null;
          throw new AppError(
            409,
            "STATUS_CONFLICT",
            "The request changed. Refresh and try again.",
            {
              currentStatus: current
                ? legacyStatusFromBookingEvidence(
                    current.status,
                    currentTransition?.toStatus,
                  )
                : null,
            },
          );
        }

        const reservedPeople = reservedPeopleForBooking(
          existing.numberOfPeople,
          existing.timeSlotId,
        );
        if (
          input.status === "cancelled" &&
          existing.timeSlotId &&
          reservedPeople
        ) {
          await capacityRepo.release(
            existing.timeSlotId,
            reservedPeople,
            tx,
          );
        }

        const event = await statusEventsRepo.createBooking(
          {
            bookingId,
            operationId,
            fromStatus: input.expectedStatus,
            toStatus: input.status,
            adminNote: note,
            actorUserId,
          },
          tx,
        );
        const customerEmail = updated.email?.trim().toLowerCase();
        if (customerEmail) {
          const store = await loadStoreContext(tx);
          const locale = updated.locale?.toLowerCase().startsWith("zh")
            ? "zh"
            : "en";
          const slotLabel =
            updated.slotDate &&
            updated.slotStartTime &&
            updated.slotEndTime
              ? `${updated.slotDate} ${updated.slotStartTime}–${updated.slotEndTime} ${updated.slotTimezone}`
              : null;
          await outboxRepo.enqueue(
            {
              dedupeKey: `booking:${bookingId}:status:${event.id}:customer`,
              bookingId,
              statusEventId: event.id,
              messageType: "booking_status_customer",
              recipient: customerEmail,
              locale,
              payload: {
                template: "booking_status",
                status: input.status,
                locale,
                customerName: updated.name,
                orderNumber: formatBookingOrderId(
                  updated.id,
                  updated.createdAt,
                ),
                preferredDate: updated.preferredDate,
                slotLabel,
                storeName: store.storeName,
                address: store.address,
                businessHours: store.businessHours,
                contact: store.contact,
                adminNote: note,
              },
            },
            tx,
          );
        }

        return {
          row: updated,
          eventId: event.id,
          replayed: false,
        };
      });
    },

    async transitionCartOrder(input: CartOrderTransitionInput) {
      validateOrderStatus(input.expectedStatus);
      validateOrderStatus(input.status);
      validateStatusTransition(input.expectedStatus, input.status);
      const cartOrderId = assertUuid(input.cartOrderId, "cartOrderId");
      const operationId = assertUuid(input.operationId, "operationId");
      const actorUserId = assertUuid(input.actorUserId, "actorUserId");
      const note = normalizeNote(input.note);

      return db.transaction(async (tx) => {
        await statusEventsRepo.lockOperation(operationId, tx);
        const priorEvent = await statusEventsRepo.findByOperationId(
          operationId,
          tx,
        );
        if (priorEvent) {
          if (
            priorEvent.cartOrderId !== cartOrderId ||
            priorEvent.fromStatus !== input.expectedStatus ||
            priorEvent.toStatus !== input.status ||
            priorEvent.actorUserId !== actorUserId ||
            normalizeNote(priorEvent.adminNote) !== note
          ) {
            throw new AppError(
              409,
              "OPERATION_ID_CONFLICT",
              "The operation ID belongs to a different status change",
            );
          }
          const replayedOrder = await cartOrdersRepo.findById(
            cartOrderId,
            tx,
          );
          if (!replayedOrder) {
            throw new AppError(404, "NOT_FOUND", "Cart order not found");
          }
          return {
            row: replayedOrder,
            eventId: priorEvent.id,
            replayed: true,
          };
        }

        const existing = await cartOrdersRepo.findById(cartOrderId, tx);
        if (!existing) {
          throw new AppError(404, "NOT_FOUND", "Cart order not found");
        }
        if (existing.status !== input.expectedStatus) {
          throw new AppError(
            409,
            "STATUS_CONFLICT",
            "The request changed. Refresh and try again.",
            { currentStatus: existing.status },
          );
        }

        const updated = await cartOrdersRepo.compareAndSetStatus(
          cartOrderId,
          input.expectedStatus,
          input.status,
          tx,
        );
        if (!updated) {
          const current = await cartOrdersRepo.findById(cartOrderId, tx);
          throw new AppError(
            409,
            "STATUS_CONFLICT",
            "The request changed. Refresh and try again.",
            { currentStatus: current?.status ?? null },
          );
        }

        if (input.status === "cancelled" && existing.timeSlotId) {
          await capacityRepo.release(
            existing.timeSlotId,
            existing.numberOfPeople ?? 1,
            tx,
          );
        }

        const event = await statusEventsRepo.createCartOrder(
          {
            cartOrderId,
            operationId,
            fromStatus: input.expectedStatus,
            toStatus: input.status,
            adminNote: note,
            actorUserId,
          },
          tx,
        );
        const customerEmail = updated.email?.trim().toLowerCase();
        if (customerEmail) {
          const store = await loadStoreContext(tx);
          const locale = updated.locale?.toLowerCase().startsWith("zh")
            ? "zh"
            : "en";
          const slotLabel =
            updated.slotDate &&
            updated.slotStartTime &&
            updated.slotEndTime
              ? `${updated.slotDate} ${updated.slotStartTime}–${updated.slotEndTime} ${updated.slotTimezone}`
              : null;
          await outboxRepo.enqueue(
            {
              dedupeKey: `cart-order:${cartOrderId}:status:${event.id}:customer`,
              cartOrderId,
              statusEventId: event.id,
              messageType: "cart_order_status_customer",
              recipient: customerEmail,
              locale,
              payload: {
                template: "booking_status",
                status: input.status,
                locale,
                customerName: updated.name,
                orderNumber: formatCartOrderId(
                  updated.id,
                  updated.createdAt,
                ),
                preferredDate: updated.preferredDate,
                slotLabel,
                storeName: store.storeName,
                address: store.address,
                businessHours: store.businessHours,
                contact: store.contact,
                adminNote: note,
              },
            },
            tx,
          );
        }

        return {
          row: updated,
          eventId: event.id,
          replayed: false,
        };
      });
    },
  };
}

export type RequestTransitionService = ReturnType<
  typeof createRequestTransitionService
>;
