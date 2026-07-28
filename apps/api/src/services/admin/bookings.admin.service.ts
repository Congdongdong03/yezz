import { bookings, emailOutbox, type Db } from "@yezz/db";
import { desc, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import {
  createBookingsRepository,
  type OrderStatus,
} from "../../repositories/bookings.repository.js";
import { createStatusEventsRepository } from "../../repositories/status-events.repository.js";
import {
  createRequestTransitionService,
  ORDER_STATUSES,
  validateOrderStatus,
  validateStatusTransition,
} from "../request-transition.service.js";

type BookingRow = typeof bookings.$inferSelect;
type DeliveryStatus = "pending" | "processing" | "sent" | "failed";

export type BookingStatusHistoryItem = {
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

export type BookingEmailDelivery = {
  id: string;
  messageType: string;
  recipient: string;
  deliveryStatus: DeliveryStatus;
  attemptCount: number;
  lastError: string | null;
  sentAt: Date | null;
  updatedAt: Date;
};

export type BookingDto = {
  id: string;
  kind: "experience" | "party";
  name: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  preferredDate: string | null;
  numberOfPeople: number | null;
  activityType: string | null;
  interestedProject: string | null;
  message: string | null;
  locale: string | null;
  timeSlotId: string | null;
  status: OrderStatus;
  offering: {
    id: string | null;
    name: { en: string; zh: string } | null;
    price: string | null;
  } | null;
  slot: {
    id: string | null;
    date: string;
    startTime: string | null;
    endTime: string | null;
    timeZone: string;
  } | null;
  notificationSummary: {
    latestStatus: DeliveryStatus | null;
    failedCount: number;
  };
  statusHistory: BookingStatusHistoryItem[];
  emailDeliveries: BookingEmailDelivery[];
  createdAt: Date;
  updatedAt: Date;
  replayed?: boolean;
};

type BookingDtoExtras = Pick<
  BookingDto,
  "notificationSummary" | "statusHistory" | "emailDeliveries"
>;

const EMPTY_EXTRAS: BookingDtoExtras = {
  notificationSummary: {
    latestStatus: null,
    failedCount: 0,
  },
  statusHistory: [],
  emailDeliveries: [],
};

export function mapBookingRow(
  row: BookingRow,
  extras: BookingDtoExtras = EMPTY_EXTRAS,
): BookingDto {
  const offeringName = row.offeringNameSnapshot ?? null;
  const offering =
    row.projectId || row.partyPackageId || offeringName || row.offeringPriceSnapshot
      ? {
          id: row.requestKind === "party" ? row.partyPackageId : row.projectId,
          name: offeringName,
          price: row.offeringPriceSnapshot ?? null,
        }
      : null;
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
    kind: row.requestKind as "experience" | "party",
    name: row.name,
    phone: row.phone,
    wechat: row.wechat ?? null,
    email: row.email ?? null,
    preferredDate: row.preferredDate ?? null,
    numberOfPeople: row.numberOfPeople ?? null,
    activityType: row.activityType ?? null,
    interestedProject: row.interestedProject ?? null,
    message: row.message ?? null,
    locale: row.locale ?? null,
    timeSlotId: row.timeSlotId ?? null,
    status: row.status,
    offering,
    slot,
    notificationSummary: extras.notificationSummary,
    statusHistory: extras.statusHistory,
    emailDeliveries: extras.emailDeliveries,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type AdminBookingsService = ReturnType<
  typeof createAdminBookingsService
>;

export function createAdminBookingsService(db: Db) {
  const repo = createBookingsRepository(db);
  const eventsRepo = createStatusEventsRepository(db);
  const transitionService = createRequestTransitionService(db);

  async function loadExtras(
    bookingId: string,
    includeHistory: boolean,
  ): Promise<BookingDtoExtras> {
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
      .where(eq(emailOutbox.bookingId, bookingId))
      .orderBy(desc(emailOutbox.createdAt));
    const history = includeHistory
      ? await eventsRepo.listForBooking(bookingId)
      : [];
    return {
      emailDeliveries: deliveries as BookingEmailDelivery[],
      notificationSummary: {
        latestStatus:
          (deliveries[0]?.deliveryStatus as DeliveryStatus | undefined) ?? null,
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

  async function getById(id: string, actorUserId?: string): Promise<BookingDto> {
    void actorUserId;
    const row = await repo.findById(id);
    if (!row) {
      throw new AppError(404, "NOT_FOUND", "Booking not found");
    }
    return mapBookingRow(row, await loadExtras(row.id, true));
  }

  return {
    async list(options?: {
      page?: number;
      limit?: number;
      status?: OrderStatus;
    }): Promise<{
      data: BookingDto[];
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
      const data = await Promise.all(
        rows.map(async (row) =>
          mapBookingRow(row, await loadExtras(row.id, false)),
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
    ): Promise<BookingDto> {
      if (!input?.status || !input.expectedStatus || !input.operationId) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "status, expectedStatus, and operationId are required",
        );
      }
      const result = await transitionService.transitionBooking({
        bookingId: id,
        expectedStatus: input.expectedStatus,
        status: input.status,
        operationId: input.operationId,
        actorUserId,
        note: input.note,
      });
      const dto = await getById(result.row.id, actorUserId);
      return { ...dto, replayed: result.replayed };
    },
  };
}

export {
  ORDER_STATUSES,
  validateOrderStatus,
  validateStatusTransition,
};
export type { OrderStatus };
