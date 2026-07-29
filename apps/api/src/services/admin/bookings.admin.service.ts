import {
  bookings,
  emailOutbox,
  type BookingStatus,
  type CustomerRescheduleRequest,
  type Db,
} from "@yezz/db";
import { desc, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import {
  legacyStatusFromBookingStatus,
  legacyStatusFromBookingEvidence,
  legacyStatusFromStoredValue,
} from "../../lib/legacy-booking-status.js";
import {
  createBookingsRepository,
  type OrderStatus,
} from "../../repositories/bookings.repository.js";
import { createAdminRequestReadsRepository } from "../../repositories/admin-request-reads.repository.js";
import { createStatusEventsRepository } from "../../repositories/status-events.repository.js";
import { createBookingCalendarRepository } from "../../repositories/booking-calendar.repository.js";
import {
  createRequestTransitionService,
  decodeOrdinaryOperationNote,
  ORDER_STATUSES,
  validateOrderStatus,
  validateStatusTransition,
} from "../request-transition.service.js";
import { createPartyWorkflowService, decodePartyOperationNote } from "../party-workflow.service.js";

type BookingRow = typeof bookings.$inferSelect;
type DeliveryStatus = "pending" | "processing" | "sent" | "failed";

export type BookingStatusHistoryItem = {
  id: string;
  operationId: string;
  fromStatus: OrderStatus | BookingStatus;
  toStatus: OrderStatus | BookingStatus;
  note: string | null;
  customerRescheduleRequest: CustomerRescheduleRequest | null;
  createdAt: Date;
  actor: {
    kind: "staff" | "customer" | "system";
    id: string;
    name: string;
    email: string;
  };
};

function historyActor(event: {
  actorKind: "staff" | "customer" | "system";
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
}): BookingStatusHistoryItem["actor"] {
  if (event.actorKind === "customer") {
    return { kind: "customer", id: "customer", name: "Customer", email: "" };
  }
  if (event.actorKind === "system") {
    return { kind: "system", id: "system", name: "System", email: "" };
  }
  return {
    kind: "staff",
    id: event.actorId ?? "staff",
    name: event.actorName ?? "Staff",
    email: event.actorEmail ?? "",
  };
}

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
  policyVersion: string | null;
  policyAcceptedAt: Date | null;
  status: OrderStatus | BookingStatus;
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
  isUnread: boolean;
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

const LIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  "pending_review", "confirmed", "waitlisted", "rejected", "time_proposed",
  "awaiting_in_store_payment", "confirmed_paid", "payment_expired",
  "reschedule_requested", "cancellation_requested", "cancelled", "refunded",
  "no_show", "completed",
];

export function validateBookingCalendarRange(from: string, to: string) {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(from) || !validDate(to)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "calendar dates must use YYYY-MM-DD",
    );
  }
  const span =
    (new Date(`${to}T00:00:00.000Z`).getTime() -
      new Date(`${from}T00:00:00.000Z`).getTime()) /
    86_400_000;
  if (span < 0 || span > 6) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "calendar range must contain one to seven inclusive days",
    );
  }
  return { from, to };
}

export function displayBookingEventStatus(status: string): OrderStatus | BookingStatus {
  if (LIVE_BOOKING_STATUSES.includes(status as BookingStatus)) {
    return status as BookingStatus;
  }
  return legacyStatusFromStoredValue(status);
}

export function mapBookingRow(
  row: BookingRow,
  extras: BookingDtoExtras = EMPTY_EXTRAS,
  latestTransitionStatus?: string | null,
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
    policyVersion: row.policyVersion ?? null,
    policyAcceptedAt: row.policyAcceptedAt ?? null,
    status: row.participantCount !== null
      ? row.status
      : legacyStatusFromBookingEvidence(
          row.status,
          latestTransitionStatus ?? extras.statusHistory.at(-1)?.toStatus,
        ),
    offering,
    slot,
    notificationSummary: extras.notificationSummary,
    statusHistory: extras.statusHistory,
    emailDeliveries: extras.emailDeliveries,
    isUnread: false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type AdminBookingsService = ReturnType<
  typeof createAdminBookingsService
>;

export function createAdminBookingsService(db: Db) {
  const repo = createBookingsRepository(db);
  const readsRepo = createAdminRequestReadsRepository(db);
  const eventsRepo = createStatusEventsRepository(db);
  const transitionService = createRequestTransitionService(db);
  const partyWorkflow = createPartyWorkflowService(db);
  const calendarRepo = createBookingCalendarRepository(db);

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
      statusHistory: history.map((event) => {
        const ordinary = decodeOrdinaryOperationNote(event.note);
        const party = decodePartyOperationNote(event.note);
        return {
          id: event.id,
          operationId: event.operationId,
          fromStatus: displayBookingEventStatus(event.fromStatus),
          toStatus: displayBookingEventStatus(event.toStatus),
          note: ordinary ? ordinary.note : party ? party.note : event.note,
          customerRescheduleRequest: event.customerRescheduleRequest,
          createdAt: event.createdAt,
          actor: historyActor(event),
        };
      }),
    };
  }

  async function getById(id: string, actorUserId?: string): Promise<BookingDto> {
    const row = await repo.findById(id);
    if (!row) {
      throw new AppError(404, "NOT_FOUND", "Booking not found");
    }
    if (actorUserId) {
      await readsRepo.markBookingRead(actorUserId, row.id);
    }
    return mapBookingRow(row, await loadExtras(row.id, true));
  }

  return {
    async getCalendar(from: string, to: string) {
      const range = validateBookingCalendarRange(from, to);
      return {
        from: range.from,
        to: range.to,
        timeZone: "Australia/Melbourne" as const,
        days: await calendarRepo.readRange(range.from, range.to),
      };
    },

    async list(options?: {
      actorUserId: string;
      page?: number;
      status?: OrderStatus;
      search?: string;
      unreadOnly?: boolean;
      overdue?: boolean;
      confirmedToday?: boolean;
    }): Promise<{
      data: BookingDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }> {
      const page = Math.max(1, options?.page ?? 1);
      const limit = 25;
      const offset = (page - 1) * limit;
      const { rows, total } = await repo.findAllOrdered({
        userId: options?.actorUserId ?? "00000000-0000-0000-0000-000000000000",
        limit,
        offset,
        status: options?.status,
        search: options?.search,
        unreadOnly: options?.unreadOnly,
        overdue: options?.overdue,
        confirmedToday: options?.confirmedToday,
      });
      const data = await Promise.all(
        rows.map(async ({ row, isUnread, latestTransitionStatus }) =>
          ({
            ...mapBookingRow(
              row,
              await loadExtras(row.id, false),
              latestTransitionStatus,
            ),
            isUnread,
          }),
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
        status?: OrderStatus;
        toStatus?: BookingStatus;
        expectedStatus: OrderStatus | BookingStatus;
        operationId: string;
        note?: string | null;
        newDate?: string;
        newStartTime?: string;
        contactedCustomer?: boolean;
      },
      actorUserId: string,
    ): Promise<BookingDto> {
      if ((!input?.status && !input?.toStatus) || !input.expectedStatus || !input.operationId) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "status, expectedStatus, and operationId are required",
        );
      }
      const row = await repo.findById(id);
      if (!row) throw new AppError(404, "NOT_FOUND", "Booking not found");
      if (row.requestKind === "party" && input.toStatus) {
        const result = await partyWorkflow.transitionPartyStatus({
          bookingId: id,
          expectedStatus: input.expectedStatus as BookingStatus,
          toStatus: input.toStatus,
          operationId: input.operationId,
          actorUserId,
          note: input.note ?? undefined,
        });
        const dto = await getById(result.id, actorUserId);
        return { ...dto, replayed: result.replayed };
      }
      if (
        input.expectedStatus === "waitlisted" &&
        (input.toStatus ?? input.status) === "confirmed" &&
        input.contactedCustomer !== true
      ) {
        throw new AppError(
          400,
          "WAITLIST_CONTACT_REQUIRED",
          "Confirm customer contact before converting a waitlist request",
        );
      }
      const result = row.participantCount !== null
        ? await transitionService.transitionOrdinary({
            bookingId: id,
            expectedStatus: input.expectedStatus as import("../../lib/booking-workflow.js").OrdinaryStatus,
            toStatus: (input.toStatus ?? input.status) as BookingStatus,
            operationId: input.operationId,
            actorUserId,
            note: input.note,
            newDate: input.newDate,
            newStartTime: input.newStartTime,
          })
        : await transitionService.transitionBooking({
            bookingId: id,
            expectedStatus: input.expectedStatus as OrderStatus,
            status: (input.status ?? input.toStatus) as OrderStatus,
            operationId: input.operationId,
            actorUserId,
            note: input.note,
          });
      const dto = await getById(result.row.id, actorUserId);
      return { ...dto, replayed: result.replayed };
    },

    async proposePartyTime(id: string, input: {
      expectedStatus: "pending_review";
      finalDate: string;
      finalGuestStart: string;
      paymentDeadline: Date;
      operationId: string;
    }, actorUserId: string) {
      return partyWorkflow.proposePartyTime({ ...input, bookingId: id, actorUserId });
    },

    async recordPartyPayment(id: string, input: {
      expectedStatus: "awaiting_in_store_payment";
      amountCents: 9500 | 14500;
      paidAt: Date;
      operationId: string;
    }, actorUserId: string) {
      return partyWorkflow.recordPartyPayment({ ...input, bookingId: id, actorUserId });
    },

    async acceptPartyTime(id: string, input: {
      expectedStatus: "time_proposed";
      operationId: string;
    }, actorUserId: string) {
      return partyWorkflow.acceptPartyTime({ ...input, bookingId: id, actorUserId });
    },

    async expirePartyHold(id: string, input: {
      expectedStatus: "awaiting_in_store_payment";
      operationId: string;
    }, actorUserId: string) {
      return partyWorkflow.expirePartyHold({ ...input, bookingId: id, actorUserId });
    },

    async recordPartyCharge(id: string, input: {
      expectedStatus: "confirmed_paid";
      type: "cake_cutting" | "cleaning" | "overtime";
      amountCents: number;
      note?: string;
      operationId: string;
    }, actorUserId: string) {
      return partyWorkflow.recordPartyCharge({ ...input, bookingId: id, actorUserId });
    },

    async recordPartyRefund(id: string, input: {
      expectedStatus: "cancelled";
      refundedAt: Date;
      operationId: string;
    }, actorUserId: string) {
      return partyWorkflow.recordPartyRefund({ ...input, bookingId: id, actorUserId });
    },
  };
}

export {
  ORDER_STATUSES,
  validateOrderStatus,
  validateStatusTransition,
};
export type { OrderStatus };
