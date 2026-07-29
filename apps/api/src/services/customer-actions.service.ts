import { createHash, randomBytes } from "node:crypto";
import type { BookingStatus, CustomerActionScope, Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import { formatBookingOrderId } from "../lib/email.js";
import { createBookingsRepository } from "../repositories/bookings.repository.js";
import { createCustomerActionTokensRepository } from "../repositories/customer-action-tokens.repository.js";
import { createEmailOutboxRepository } from "../repositories/email-outbox.repository.js";
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
  proposedTime?: { date: string; startTime: string; endTime: string };
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

function locale(value: string | null): "en" | "zh" {
  return value?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function allowedActions(
  scopes: CustomerActionScope[],
  status: BookingStatus,
): CustomerActionScope[] {
  const permitted = new Set<CustomerActionScope>();
  if (status === "confirmed" || status === "confirmed_paid") {
    permitted.add("request_cancellation");
    permitted.add("request_reschedule");
  }
  // accept_time is intentionally resolvable only; Task 6 exposes it.
  return scopes.filter((scope) => scope !== "accept_time" && permitted.has(scope));
}

function ownerEmail(): string {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(503, "OWNER_EMAIL_UNAVAILABLE", "Booking notifications are temporarily unavailable");
  }
  return email;
}

function assertRequestTime(input: { date: string; startTime: string }): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) {
    throw new AppError(400, "VALIDATION_ERROR", "date and startTime are required");
  }
}

export type CustomerActionsService = ReturnType<typeof createCustomerActionsService>;

export function createCustomerActionsService(
  db: Db,
  dependencies?: { now?: () => Date },
) {
  const now = dependencies?.now ?? (() => new Date());
  const bookingsRepo = createBookingsRepository(db);
  const tokensRepo = createCustomerActionTokensRepository(db);
  const eventsRepo = createStatusEventsRepository(db);
  const outboxRepo = createEmailOutboxRepository(db);

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
    if (scope && !token.scopes.includes(scope)) throw forbidden();
    if (
      !booking.slotDate ||
      !booking.slotStartTime ||
      !booking.slotEndTime ||
      (booking.requestKind !== "experience" && booking.requestKind !== "party")
    ) {
      throw invalidLink();
    }
    const bookingLocale = locale(booking.locale);
    const label = booking.offeringNameSnapshot?.[bookingLocale]
      ?? booking.offeringNameSnapshot?.en
      ?? booking.offeringNameSnapshot?.zh
      ?? (booking.requestKind === "party" ? "Party booking" : "DIY booking");
    const view: CustomerBookingView = {
      kind: booking.requestKind,
      status: booking.status,
      locale: bookingLocale,
      offeringLabel: label,
      date: booking.slotDate,
      startTime: booking.slotStartTime,
      endTime: booking.slotEndTime,
      allowedActions: allowedActions(token.scopes, booking.status),
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
      const notificationEmail = ownerEmail();
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
      await outboxRepo.enqueue(
        {
          dedupeKey: `booking:${updated.id}:customer-action:${event.id}:owner`,
          bookingId: updated.id,
          messageType: "booking_received_owner",
          recipient: notificationEmail,
          locale: "en",
          payload: {
            template: "owner_request",
            subject: `Customer ${toStatus.replaceAll("_", " ")} ${formatBookingOrderId(updated.id, updated.createdAt)}`,
            heading: "Customer booking action requested",
            fields: [
              { label: "Customer", value: updated.name },
              { label: "Booking", value: formatBookingOrderId(updated.id, updated.createdAt) },
              { label: "Action", value: toStatus },
              ...(request
                ? [
                    { label: "Requested date", value: request.date },
                    { label: "Requested start", value: request.startTime },
                  ]
                : []),
            ],
          },
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
