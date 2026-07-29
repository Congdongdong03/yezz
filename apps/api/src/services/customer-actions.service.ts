import { createHash, randomBytes } from "node:crypto";
import type { BookingStatus, CustomerActionScope, Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import {
  bookingLocale,
  bookingOfferingLabel,
  customerManageUrl,
  notificationPayload,
  staffBookingUrl,
} from "../lib/booking-notification.js";
import { CANONICAL_BOOKING_EMAIL_IDENTITY } from "../lib/email-outbox-payload.js";
import { createBookingsRepository } from "../repositories/bookings.repository.js";
import { createCustomerActionTokensRepository } from "../repositories/customer-action-tokens.repository.js";
import { createEmailOutboxRepository } from "../repositories/email-outbox.repository.js";
import { createPartyWorkflowRepository } from "../repositories/party-workflow.repository.js";
import { createStatusEventsRepository } from "../repositories/status-events.repository.js";

const SCOPES: readonly CustomerActionScope[] = [
  "accept_time",
  "request_cancellation",
  "request_reschedule",
];

export type CustomerBookingView = {
  kind: "experience" | "party";
  status: BookingStatus;
  locale: "en" | "zh";
  offeringLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  allowedActions: CustomerActionScope[];
  proposedTime?: {
    date: string;
    startTime: string;
    endTime: string;
    paymentDeadline: string;
  };
};

type ResolvedAction = {
  token: { bookingId: string; scopes: CustomerActionScope[] };
  view: CustomerBookingView;
};

function invalidLink(): AppError {
  return new AppError(404, "LINK_INVALID_OR_EXPIRED", "This link is invalid or expired");
}

function forbidden(): AppError {
  return new AppError(403, "CUSTOMER_ACTION_FORBIDDEN", "This action is not available for this booking");
}

function validRawToken(rawToken: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(rawToken);
}

function allowedActions(
  scopes: CustomerActionScope[],
  status: BookingStatus,
): CustomerActionScope[] {
  const permitted = new Set<CustomerActionScope>();
  if (status === "time_proposed") permitted.add("accept_time");
  if (status === "confirmed" || status === "confirmed_paid") {
    permitted.add("request_cancellation");
    permitted.add("request_reschedule");
  }
  return scopes.filter((scope) => permitted.has(scope));
}

function assertRequestTime(input: { date: string; startTime: string }): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) {
    throw new AppError(400, "VALIDATION_ERROR", "date and startTime are required");
  }
}

export type CustomerActionsService = ReturnType<typeof createCustomerActionsService>;

export function createCustomerActionsService(
  db: Db,
  dependencies?: { now?: () => Date; customerManageBaseUrl?: string },
) {
  const now = dependencies?.now ?? (() => new Date());
  const bookingsRepo = createBookingsRepository(db);
  const tokensRepo = createCustomerActionTokensRepository(db);
  const eventsRepo = createStatusEventsRepository(db);
  const outboxRepo = createEmailOutboxRepository(db);
  const partyRepo = createPartyWorkflowRepository(db);

  function digest(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  async function resolveAction(
    rawToken: string,
    scope?: CustomerActionScope,
    tx: Db = db,
  ): Promise<ResolvedAction> {
    if (!validRawToken(rawToken)) throw invalidLink();
    const token = await tokensRepo.findActiveByDigest(digest(rawToken), now(), tx);
    if (!token) throw invalidLink();
    const booking = await bookingsRepo.findById(token.bookingId, tx);
    if (!booking || booking.status === "cancelled") throw invalidLink();
    const isAcceptView =
      booking.requestKind === "party" &&
      booking.status === "time_proposed" &&
      token.scopes.includes("accept_time");
    if (
      (booking.status === "time_proposed" || token.scopes.includes("accept_time")) &&
      !isAcceptView
    ) {
      throw invalidLink();
    }
    if (scope && !token.scopes.includes(scope)) throw forbidden();
    if (
      !booking.slotDate ||
      !booking.slotStartTime ||
      !booking.slotEndTime ||
      (booking.requestKind !== "experience" && booking.requestKind !== "party")
    ) {
      throw invalidLink();
    }
    const resolvedLocale = bookingLocale(booking.locale);
    const label = bookingOfferingLabel(
      booking.offeringNameSnapshot,
      resolvedLocale,
      booking.requestKind,
    );
    const partyDetails =
      booking.requestKind === "party"
        ? await partyRepo.findDetails(booking.id, tx)
        : null;
    if (
      booking.status === "time_proposed" &&
      (!partyDetails?.finalDate ||
        !partyDetails.finalGuestStart ||
        !partyDetails.finalGuestEnd ||
        !partyDetails.paymentDeadline ||
        partyDetails.paymentDeadline <= now())
    ) {
      throw invalidLink();
    }
    const date = partyDetails?.finalDate ?? booking.slotDate;
    const startTime = partyDetails?.finalGuestStart ?? booking.slotStartTime;
    const endTime = partyDetails?.finalGuestEnd ?? booking.slotEndTime;
    if (!date || !startTime || !endTime) throw invalidLink();
    const view: CustomerBookingView = {
      kind: booking.requestKind,
      status: booking.status,
      locale: resolvedLocale,
      offeringLabel: label,
      date,
      startTime,
      endTime,
      allowedActions: allowedActions(token.scopes, booking.status),
      ...(booking.status === "time_proposed" && partyDetails?.paymentDeadline
        ? {
            proposedTime: {
              date,
              startTime,
              endTime,
              paymentDeadline: partyDetails.paymentDeadline.toISOString(),
            },
          }
        : {}),
    };
    return { token, view };
  }

  async function requestStatusChange(
    rawToken: string,
    scope: "request_cancellation" | "request_reschedule",
    toStatus: "cancellation_requested" | "reschedule_requested",
    request?: { date: string; startTime: string },
  ): Promise<CustomerBookingView> {
    if (request) assertRequestTime(request);
    return db.transaction(async (tx) => {
      const resolved = await resolveAction(rawToken, scope, tx);
      if (resolved.view.status !== "confirmed" && resolved.view.status !== "confirmed_paid") {
        throw forbidden();
      }
      const updated = await bookingsRepo.compareAndSetOrdinaryStatus(
        resolved.token.bookingId,
        resolved.view.status,
        toStatus,
        tx,
      );
      if (!updated) throw forbidden();
      const event = await eventsRepo.createBooking(
        {
          bookingId: updated.id,
          operationId: crypto.randomUUID(),
          fromStatus: resolved.view.status,
          toStatus,
          adminNote: null,
          customerRescheduleRequest: request ?? null,
          actorUserId: null,
          actorKind: "customer",
        },
        tx,
      );
      if (!updated.email) throw invalidLink();
      const template =
        scope === "request_cancellation"
          ? "cancellation_request"
          : "reschedule_request";
      const customerPayload = notificationPayload({
        template,
        booking: updated,
        locale: resolved.view.locale,
        date: resolved.view.date,
        startTime: resolved.view.startTime,
        endTime: resolved.view.endTime,
        manageUrl: customerManageUrl(
          resolved.view.locale,
          rawToken,
          dependencies?.customerManageBaseUrl,
        ),
        ...(request
          ? {
              note: `Requested ${request.date} at ${request.startTime}`,
            }
          : {}),
      });
      await outboxRepo.enqueue(
        {
          dedupeKey: `booking:${updated.id}:event:${event.id}:${template}:customer`,
          bookingId: updated.id,
          statusEventId: event.id,
          messageType: "booking_notification_customer",
          recipient: updated.email,
          locale: resolved.view.locale,
          payload: customerPayload,
        },
        tx,
      );
      await outboxRepo.enqueue(
        {
          dedupeKey: `booking:${updated.id}:event:${event.id}:staff_notification:owner`,
          bookingId: updated.id,
          statusEventId: event.id,
          messageType: "booking_notification_owner",
          recipient: CANONICAL_BOOKING_EMAIL_IDENTITY.contactEmail,
          locale: "en",
          payload: notificationPayload({
            template: "staff_notification",
            booking: updated,
            locale: "en",
            date: resolved.view.date,
            startTime: resolved.view.startTime,
            endTime: resolved.view.endTime,
            manageUrl: staffBookingUrl(
              updated.id,
              dependencies?.customerManageBaseUrl,
            ),
            note: request
              ? `${toStatus}: ${request.date} at ${request.startTime}`
              : toStatus,
            customerEmail: updated.email,
            customerPhone: updated.phone,
          }),
        },
        tx,
      );
      return {
        ...resolved.view,
        status: updated.status,
        allowedActions: [],
      };
    });
  }

  return {
    digest,

    async issue(input: {
      bookingId: string;
      scopes: CustomerActionScope[];
      expiresAt: Date;
    }): Promise<string> {
      if (
        !input.scopes.length ||
        input.scopes.some((scope) => !SCOPES.includes(scope)) ||
        !(input.expiresAt instanceof Date) ||
        Number.isNaN(input.expiresAt.getTime()) ||
        input.expiresAt <= now()
      ) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid customer action token input");
      }
      const booking = await bookingsRepo.findById(input.bookingId);
      if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
      const raw = randomBytes(32).toString("base64url");
      await tokensRepo.create({
        bookingId: input.bookingId,
        tokenDigest: digest(raw),
        scopes: [...new Set(input.scopes)],
        expiresAt: input.expiresAt,
      });
      return raw;
    },

    async resolve(rawToken: string, scope?: CustomerActionScope): Promise<CustomerBookingView> {
      return (await resolveAction(rawToken, scope)).view;
    },

    async requestCancellation(rawToken: string): Promise<CustomerBookingView> {
      return requestStatusChange(rawToken, "request_cancellation", "cancellation_requested");
    },

    async requestReschedule(
      rawToken: string,
      request: { date: string; startTime: string },
    ): Promise<CustomerBookingView> {
      return requestStatusChange(rawToken, "request_reschedule", "reschedule_requested", request);
    },
  };
}
