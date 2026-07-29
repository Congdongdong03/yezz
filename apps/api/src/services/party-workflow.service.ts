import type { BookingStatus, Db } from "@yezz/db";
import { createHash, createHmac } from "node:crypto";
import { AppError } from "../lib/errors.js";
import { getMelbourneClock, parseCalendarDate, validateBookingWindow } from "../lib/booking-policy.js";
import {
  bookingLocale,
  customerManageUrl,
  issueDeterministicManagementToken,
  notificationPayload,
  staffBookingUrl,
} from "../lib/booking-notification.js";
import { CANONICAL_BOOKING_EMAIL_IDENTITY } from "../lib/email-outbox-payload.js";
import { formatBookingOrderId } from "../lib/email.js";
import { createBookingAvailabilityRepository } from "../repositories/booking-availability.repository.js";
import { createBookingsRepository } from "../repositories/bookings.repository.js";
import { createCustomerActionTokensRepository } from "../repositories/customer-action-tokens.repository.js";
import { createEmailOutboxRepository } from "../repositories/email-outbox.repository.js";
import { createPartiesRepository } from "../repositories/parties.repository.js";
import { createPartyWorkflowRepository } from "../repositories/party-workflow.repository.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import { createStatusEventsRepository } from "../repositories/status-events.repository.js";
import { createStudioScheduleRepository } from "../repositories/studio-schedule.repository.js";

export type PartyCreateInput = {
  kind: "party";
  partyPackageId: string;
  name: string;
  phone: string;
  email: string;
  birthdayChildName: string;
  birthdayChildAge: number;
  participantCount: number;
  parentCount: 1 | 2;
  desiredDate: string;
  desiredStartTime: string;
  projectInterests: string[];
  byoCake: boolean;
  byoDrinks: boolean;
  byoFood: boolean;
  byoSnacks: boolean;
  cakeCuttingRequested: boolean;
  specialRequirements?: string;
  locale: "en" | "zh";
  policyVersion: "2026-07-29";
  policyAccepted: true;
};

type PartyBookingDto = { id: string; status: BookingStatus; createdAt: Date; replayed: boolean };

const PARTY_TRANSITIONS: Partial<Record<BookingStatus, readonly BookingStatus[]>> = {
  pending_review: ["rejected", "cancelled"],
  time_proposed: ["cancelled"],
  awaiting_in_store_payment: ["cancelled"],
  confirmed_paid: ["cancellation_requested", "no_show", "completed"],
  cancellation_requested: ["confirmed_paid", "cancelled"],
};

function melbourneLocalInstant(date: string, startTime: string): Date {
  const target = parseCalendarDate(date).ordinal * 1_440 + minutes(startTime);
  let instant = new Date(`${date}T${startTime}:00.000Z`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = getMelbourneClock(instant);
    const observedMinute = parseCalendarDate(observed.date).ordinal * 1_440 + observed.minuteOfDay;
    const delta = target - observedMinute;
    if (delta === 0) return instant;
    instant = new Date(instant.getTime() + delta * 60_000);
  }
  return instant;
}

function encodePartyOperation(payload: Record<string, unknown>): string {
  return JSON.stringify({ partyWorkflow: 1, ...payload });
}

export function decodePartyOperationNote(value: string | null): { note: string | null } | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || !("partyWorkflow" in parsed) || parsed.partyWorkflow !== 1) return null;
    if ("note" in parsed && parsed.note !== null && typeof parsed.note !== "string") return null;
    return { note: "note" in parsed && typeof parsed.note === "string" ? parsed.note : null };
  } catch {
    return null;
  }
}

function minutes(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new AppError(400, "VALIDATION_ERROR", "time must use HH:MM");
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function time(value: number): string {
  if (value < 0 || value >= 24 * 60) throw new AppError(400, "VALIDATION_ERROR", "party setup and cleanup must remain on the operational date");
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function partyInterval(date: string, guestStart: string, guestDurationMinutes: number, setupMinutes: number, cleanupMinutes: number) {
  const start = minutes(guestStart);
  return {
    date,
    setupStart: time(start - setupMinutes),
    guestStart,
    guestEnd: time(start + guestDurationMinutes),
    cleanupEnd: time(start + guestDurationMinutes + cleanupMinutes),
  };
}

function assertUuid(value: string | undefined, field: string): string {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a UUID`);
  }
  return value.toLowerCase();
}

function assertPartyInput(input: PartyCreateInput): void {
  if (!input.name.trim() || !input.phone.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    throw new AppError(400, "VALIDATION_ERROR", "name, phone, and a valid email are required");
  }
  if (!input.policyAccepted || input.policyVersion !== "2026-07-29") throw new AppError(400, "VALIDATION_ERROR", "The current booking policy must be accepted");
  if (!Number.isInteger(input.participantCount) || input.participantCount < 4 || input.participantCount > 8 || !Number.isInteger(input.parentCount) || input.parentCount < 1 || input.parentCount > 2) {
    throw new AppError(400, "PARTY_ATTENDANCE_INVALID", "Party guests must be 4–8 and parents must be 1–2");
  }
  if (!Number.isInteger(input.birthdayChildAge) || input.birthdayChildAge < 5) throw new AppError(400, "PARTY_BIRTHDAY_AGE_INVALID", "Birthday child must be at least five");
  if (!input.birthdayChildName.trim() || !Array.isArray(input.projectInterests) || input.projectInterests.length === 0 || input.projectInterests.some((value) => !value.trim())) {
    throw new AppError(400, "VALIDATION_ERROR", "birthdayChildName and projectInterests are required");
  }
}

function canonicalProjectInterests(projectInterests: string[]): string[] {
  return projectInterests.map((value) => value.trim());
}

export function createPartyWorkflowService(db: Db, dependencies?: {
  now?: () => Date;
  customerActionTokenSecret?: string;
  customerManageBaseUrl?: string;
}) {
  const bookingsRepo = createBookingsRepository(db);
  const partiesRepo = createPartiesRepository(db);
  const partyRepo = createPartyWorkflowRepository(db);
  const scheduleRepo = createStudioScheduleRepository(db);
  const availabilityRepo = createBookingAvailabilityRepository(db);
  const tokensRepo = createCustomerActionTokensRepository(db);
  const eventsRepo = createStatusEventsRepository(db);
  const outboxRepo = createEmailOutboxRepository(db);
  const now = dependencies?.now ?? (() => new Date());
  const customerActionTokenSecret = dependencies?.customerActionTokenSecret ?? process.env.CUSTOMER_ACTION_TOKEN_SECRET;

  function acceptTimeToken(bookingId: string, operationId: string): string {
    if (!customerActionTokenSecret || Buffer.byteLength(customerActionTokenSecret) < 32) {
      throw new AppError(503, "CUSTOMER_ACTION_TOKEN_SECRET_UNAVAILABLE", "Customer action tokens are temporarily unavailable");
    }
    return createHmac("sha256", customerActionTokenSecret).update(`party-accept:${bookingId}:${operationId}`).digest("base64url");
  }

  async function packageFor(booking: { partyPackageId: string | null }, tx: Db) {
    const partyPackage = booking.partyPackageId ? await partiesRepo.findById(booking.partyPackageId, tx) : null;
    if (!partyPackage || !partyPackage.guestDurationMinutes || !partyPackage.setupMinutes || !partyPackage.cleanupMinutes) throw new AppError(422, "PARTY_PACKAGE_INVALID", "Party package is not configured for live booking");
    return partyPackage;
  }

  async function validateGuestWindow(date: string, startTime: string, durationMinutes: 90 | 150, tx: Db) {
    const schedule = await scheduleRepo.resolveDay(date);
    if (schedule.isClosed || !schedule.opensAt || !schedule.closesAt) throw new AppError(400, "STUDIO_CLOSED", "The studio is closed on this date");
    validateBookingWindow({ date, startTime, durationMinutes }, getMelbourneClock(now()), { opensAt: schedule.opensAt, closesAt: schedule.closesAt });
    const end = time(minutes(startTime) + durationMinutes);
    if (schedule.closures.some((closure) => closure.startTime === null || closure.endTime === null || (startTime < closure.endTime && end > closure.startTime))) {
      throw new AppError(400, "STUDIO_CLOSED", "The party guest time overlaps a closure");
    }
  }

  async function assertCanHold(bookingId: string, interval: { date: string; setupStart: string; cleanupEnd: string }, tx: Db) {
    await availabilityRepo.lockOperationalDate(interval.date, tx);
    if (await availabilityRepo.hasExclusivePartyOverlap({ date: interval.date, startTime: interval.setupStart, endTime: interval.cleanupEnd }, tx)) {
      throw new AppError(409, "CAPACITY_CONFLICT", "The requested interval is already held");
    }
    if (await availabilityRepo.sumConfirmedAttendance({ date: interval.date, startTime: interval.setupStart, endTime: interval.cleanupEnd }, tx)) {
      throw new AppError(409, "CAPACITY_CONFLICT", "The requested interval conflicts with a confirmed booking");
    }
  }

  async function recordTransition(input: { bookingId: string; expectedStatus: BookingStatus; toStatus: BookingStatus; operationId: string; actorUserId: string | null; actorKind?: "staff" | "customer" | "system"; operationPayload: Record<string, unknown> }, tx: Db) {
    await eventsRepo.lockOperation(input.operationId, tx);
    const prior = await eventsRepo.findByOperationId(input.operationId, tx);
    if (prior) {
      if (prior.bookingId !== input.bookingId || prior.fromStatus !== input.expectedStatus || prior.toStatus !== input.toStatus || prior.actorUserId !== input.actorUserId || prior.adminNote !== encodePartyOperation(input.operationPayload)) throw new AppError(409, "OPERATION_ID_CONFLICT", "The operation ID belongs to a different party action");
      const replay = await bookingsRepo.findById(input.bookingId, tx);
      if (!replay) throw new AppError(404, "NOT_FOUND", "Booking not found");
      return { booking: replay, replayed: true };
    }
    const booking = await bookingsRepo.findById(input.bookingId, tx);
    if (!booking || booking.requestKind !== "party") throw new AppError(404, "NOT_FOUND", "Party booking not found");
    if (booking.status !== input.expectedStatus) throw new AppError(409, "STATUS_CONFLICT", "The party booking changed. Refresh and try again.");
    return { booking, replayed: false };
  }

  function invalidLink(): AppError {
    return new AppError(404, "LINK_INVALID_OR_EXPIRED", "This link is invalid or expired");
  }

  async function enqueuePartyLifecycle(input: {
    booking: Awaited<ReturnType<typeof bookingsRepo.findById>> & {};
    statusEventId: string;
    template:
      | "party_time_proposed"
      | "party_payment_due"
      | "party_payment_recorded"
      | "party_payment_expired";
    date: string;
    startTime: string;
    endTime: string;
    paymentDeadline?: Date;
    amountCents?: 9500 | 14500;
    rawToken?: string;
  }, tx: Db): Promise<void> {
    if (!input.booking.email) {
      throw new AppError(422, "PARTY_EMAIL_MISSING", "Party booking email is required");
    }
    const messageLocale = bookingLocale(input.booking.locale);
    const rawToken =
      input.rawToken ??
      (await issueDeterministicManagementToken(
        {
          bookingId: input.booking.id,
          identity: `event:${input.statusEventId}:${input.template}`,
          now: now(),
          secret: customerActionTokenSecret,
        },
        tx,
      ));
    await outboxRepo.enqueue(
      {
        dedupeKey: `booking:${input.booking.id}:event:${input.statusEventId}:${input.template}:customer`,
        bookingId: input.booking.id,
        statusEventId: input.statusEventId,
        messageType: "booking_notification_customer",
        recipient: input.booking.email,
        locale: messageLocale,
        payload: notificationPayload({
          template: input.template,
          booking: input.booking,
          locale: messageLocale,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          manageUrl: customerManageUrl(
            messageLocale,
            rawToken,
            dependencies?.customerManageBaseUrl,
          ),
          ...(input.paymentDeadline
            ? { paymentDeadline: input.paymentDeadline.toISOString() }
            : {}),
          ...(input.amountCents ? { amountCents: input.amountCents } : {}),
        }),
      },
      tx,
    );
  }

  async function enqueuePartyCreated(input: {
    booking: Awaited<ReturnType<typeof bookingsRepo.findById>> & {};
    partyPackage: Awaited<ReturnType<typeof partiesRepo.findById>> & {};
    request: PartyCreateInput;
  }, tx: Db): Promise<void> {
    if (!input.booking.email) {
      throw new AppError(422, "PARTY_EMAIL_MISSING", "Party booking email is required");
    }
    const messageLocale = bookingLocale(input.booking.locale);
    const duration = input.partyPackage.guestDurationMinutes!;
    const endTime = time(minutes(input.request.desiredStartTime) + duration);
    const orderNumber = formatBookingOrderId(
      input.booking.id,
      input.booking.createdAt,
    );
    const settings = await createSettingsRepository(tx).findSingleton();
    await outboxRepo.enqueue(
      {
        dedupeKey: `booking:${input.booking.id}:received:customer`,
        bookingId: input.booking.id,
        messageType: "booking_received_customer",
        recipient: input.booking.email,
        locale: messageLocale,
        payload: {
          template: "booking_received",
          storeName: CANONICAL_BOOKING_EMAIL_IDENTITY.storeName,
          orderId: input.booking.id,
          orderNumber,
          submittedAt: input.booking.createdAt.toISOString(),
          input: {
            name: input.booking.name,
            phone: input.booking.phone,
            email: input.booking.email,
            preferredDate: input.request.desiredDate,
            numberOfPeople:
              input.request.participantCount + input.request.parentCount,
            activityType: "party",
            interestedProject: input.request.projectInterests.join(", "),
            message: input.request.specialRequirements?.trim() || null,
            locale: messageLocale,
          },
          contact: {
            phone: CANONICAL_BOOKING_EMAIL_IDENTITY.contactPhone,
            email: CANONICAL_BOOKING_EMAIL_IDENTITY.contactEmail,
            wechatId: settings?.wechatId ?? null,
          },
        },
      },
      tx,
    );
    await outboxRepo.enqueue(
      {
        dedupeKey: `booking:${input.booking.id}:created:staff_notification:owner`,
        bookingId: input.booking.id,
        messageType: "booking_notification_owner",
        recipient: CANONICAL_BOOKING_EMAIL_IDENTITY.contactEmail,
        locale: "en",
        payload: notificationPayload({
          template: "staff_notification",
          booking: input.booking,
          locale: "en",
          date: input.request.desiredDate,
          startTime: input.request.desiredStartTime,
          endTime,
          manageUrl: staffBookingUrl(
            input.booking.id,
            dependencies?.customerManageBaseUrl,
          ),
          note: "New party request",
          customerEmail: input.booking.email,
          customerPhone: input.booking.phone,
        }),
      },
      tx,
    );
  }

  async function assertPartyReplay(booking: Awaited<ReturnType<typeof bookingsRepo.findByIdempotencyKey>> & {}, input: PartyCreateInput, packageId: string, tx: Db = db): Promise<void> {
    if (!booking || booking.requestKind !== "party" || booking.partyPackageId !== packageId) {
      throw new AppError(409, "IDEMPOTENCY_KEY_CONFLICT", "The idempotency key belongs to a different booking request");
    }
    const details = await partyRepo.findDetails(booking.id, tx);
    const same = Boolean(details) &&
      booking.name === input.name.trim() && booking.phone === input.phone.trim() && booking.email === input.email.trim().toLowerCase() &&
      booking.locale === input.locale && booking.policyVersion === input.policyVersion && Boolean(booking.policyAcceptedAt) &&
      booking.interestedProject === input.projectInterests.join(", ") && booking.message === (input.specialRequirements?.trim() || null) &&
      details!.birthdayChildName === input.birthdayChildName.trim() && details!.birthdayChildAge === input.birthdayChildAge &&
      details!.participantCount === input.participantCount && details!.parentCount === input.parentCount &&
      details!.desiredDate === input.desiredDate && details!.desiredStartTime === input.desiredStartTime &&
      details!.byoCake === input.byoCake && details!.byoDrinks === input.byoDrinks && details!.byoFood === input.byoFood && details!.byoSnacks === input.byoSnacks &&
      details!.cakeCuttingRequested === input.cakeCuttingRequested && details!.specialRequirements === (input.specialRequirements?.trim() || null);
    if (!same) throw new AppError(409, "IDEMPOTENCY_KEY_CONFLICT", "The idempotency key belongs to a different booking request");
  }

  return {
    async createPartyRequest(input: PartyCreateInput, idempotencyKey?: string): Promise<PartyBookingDto> {
      assertPartyInput(input);
      const canonicalInput = { ...input, projectInterests: canonicalProjectInterests(input.projectInterests) };
      const key = assertUuid(idempotencyKey, "Idempotency-Key");
      const packageId = assertUuid(canonicalInput.partyPackageId, "partyPackageId");
      const existing = await bookingsRepo.findByIdempotencyKey(key);
      if (existing) {
        await assertPartyReplay(existing, canonicalInput, packageId);
        return { id: existing.id, status: existing.status, createdAt: existing.createdAt, replayed: true };
      }
      return db.transaction(async (tx) => {
        await bookingsRepo.lockCreateAttempt(key, tx);
        const replay = await bookingsRepo.findByIdempotencyKey(key, tx);
        if (replay) {
          await assertPartyReplay(replay, canonicalInput, packageId, tx);
          return { id: replay.id, status: replay.status, createdAt: replay.createdAt, replayed: true };
        }
        const partyPackage = await partiesRepo.findById(packageId, tx);
        if (!partyPackage) throw new AppError(404, "PARTY_PACKAGE_NOT_FOUND", "Party package not found");
        if ((partyPackage.guestDurationMinutes !== 90 && partyPackage.guestDurationMinutes !== 150) ||
          (partyPackage.guestDurationMinutes === 90 && partyPackage.venueFeeCents !== 9500) ||
          (partyPackage.guestDurationMinutes === 150 && partyPackage.venueFeeCents !== 14500) ||
          !partyPackage.setupMinutes || !partyPackage.cleanupMinutes || partyPackage.minSpendPerPersonCents !== 4500) {
          throw new AppError(422, "PARTY_PACKAGE_INVALID", "Party package is not configured for live booking");
        }
        const schedule = await scheduleRepo.resolveDay(canonicalInput.desiredDate);
        if (schedule.isClosed || !schedule.opensAt || !schedule.closesAt) throw new AppError(400, "STUDIO_CLOSED", "The studio is closed on this date");
        validateBookingWindow({ date: canonicalInput.desiredDate, startTime: canonicalInput.desiredStartTime, durationMinutes: partyPackage.guestDurationMinutes }, getMelbourneClock(now()), { opensAt: schedule.opensAt, closesAt: schedule.closesAt });
        const row = await partyRepo.createRequest({
          ...canonicalInput,
          partyPackageId: packageId,
          idempotencyKey: key,
          offeringNameSnapshot: partyPackage.name,
          venueFeeCents: partyPackage.venueFeeCents!,
          minSpendPerPersonCents: partyPackage.minSpendPerPersonCents!,
        }, tx);
        await enqueuePartyCreated(
          { booking: row, partyPackage, request: canonicalInput },
          tx,
        );
        return { id: row.id, status: row.status, createdAt: row.createdAt, replayed: false };
      });
    },

    async proposePartyTime(input: {
      bookingId: string;
      expectedStatus: "pending_review";
      finalDate: string;
      finalGuestStart: string;
      paymentDeadline: Date;
      operationId: string;
      actorUserId: string;
    }): Promise<PartyBookingDto & { acceptTimeToken?: string }> {
      const bookingId = assertUuid(input.bookingId, "bookingId");
      const operationId = assertUuid(input.operationId, "operationId");
      const actorUserId = assertUuid(input.actorUserId, "actorUserId");
      if (!(input.paymentDeadline instanceof Date) || Number.isNaN(input.paymentDeadline.getTime())) throw new AppError(400, "VALIDATION_ERROR", "paymentDeadline must be a valid date");
      const operationPayload = { action: "propose", finalDate: input.finalDate, finalGuestStart: input.finalGuestStart, paymentDeadline: input.paymentDeadline.toISOString() };
      return db.transaction(async (tx) => {
        await eventsRepo.lockOperation(operationId, tx);
        const prior = await eventsRepo.findByOperationId(operationId, tx);
        if (prior) {
          if (prior.bookingId !== bookingId || prior.fromStatus !== input.expectedStatus || prior.actorUserId !== actorUserId || prior.adminNote !== encodePartyOperation(operationPayload) || (prior.toStatus !== "time_proposed" && prior.toStatus !== "awaiting_in_store_payment")) throw new AppError(409, "OPERATION_ID_CONFLICT", "The operation ID belongs to a different party action");
          const replay = await bookingsRepo.findById(bookingId, tx);
          if (!replay) throw new AppError(404, "NOT_FOUND", "Booking not found");
          if (prior.toStatus === "time_proposed") {
            const details = await partyRepo.findDetails(bookingId, tx);
            if (!details?.paymentDeadline) throw new AppError(409, "STATUS_CONFLICT", "Party proposal is incomplete");
            if (replay.status !== "time_proposed" || details.paymentDeadline <= now()) {
              return { id: replay.id, status: replay.status, createdAt: replay.createdAt, replayed: true };
            }
            return { id: replay.id, status: replay.status, createdAt: replay.createdAt, replayed: true, acceptTimeToken: acceptTimeToken(bookingId, operationId) };
          }
          return { id: replay.id, status: replay.status, createdAt: replay.createdAt, replayed: true };
        }
        if (input.paymentDeadline <= now()) throw new AppError(400, "VALIDATION_ERROR", "paymentDeadline must be in the future");
        const booking = await bookingsRepo.findById(bookingId, tx);
        if (!booking || booking.requestKind !== "party") throw new AppError(404, "NOT_FOUND", "Party booking not found");
        if (booking.status !== input.expectedStatus) throw new AppError(409, "STATUS_CONFLICT", "The party booking changed. Refresh and try again.");
        const details = await partyRepo.findDetails(bookingId, tx);
        if (!details) throw new AppError(404, "NOT_FOUND", "Party booking details not found");
        const partyPackage = await packageFor(booking, tx);
        const duration = partyPackage.guestDurationMinutes as 90 | 150;
        await validateGuestWindow(input.finalDate, input.finalGuestStart, duration, tx);
        const interval = partyInterval(input.finalDate, input.finalGuestStart, duration, partyPackage.setupMinutes!, partyPackage.cleanupMinutes!);
        const sameDesired = details.desiredDate === input.finalDate && details.desiredStartTime === input.finalGuestStart;
        const target = sameDesired ? "awaiting_in_store_payment" : "time_proposed" as const;
        if (sameDesired) await assertCanHold(bookingId, interval, tx);
        const updated = await partyRepo.setProposal({ bookingId, expectedStatus: input.expectedStatus, date: input.finalDate, setupStart: interval.setupStart, guestStart: interval.guestStart, guestEnd: interval.guestEnd, cleanupEnd: interval.cleanupEnd, paymentDeadline: input.paymentDeadline, status: target }, tx);
        if (!updated) throw new AppError(409, "STATUS_CONFLICT", "The party booking changed. Refresh and try again.");
        const event = await eventsRepo.createBooking({ bookingId, operationId, fromStatus: input.expectedStatus, toStatus: target, adminNote: encodePartyOperation(operationPayload), actorUserId }, tx);
        if (target === "awaiting_in_store_payment") {
          await enqueuePartyLifecycle({
            booking: updated,
            statusEventId: event.id,
            template: "party_payment_due",
            date: interval.date,
            startTime: interval.guestStart,
            endTime: interval.guestEnd,
            paymentDeadline: input.paymentDeadline,
            amountCents: partyPackage.venueFeeCents as 9500 | 14500,
          }, tx);
          return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false };
        }
        const raw = acceptTimeToken(bookingId, operationId);
        await tokensRepo.create({ bookingId, tokenDigest: createHash("sha256").update(raw).digest("hex"), scopes: ["accept_time"], expiresAt: input.paymentDeadline }, tx);
        await enqueuePartyLifecycle({
          booking: updated,
          statusEventId: event.id,
          template: "party_time_proposed",
          date: interval.date,
          startTime: interval.guestStart,
          endTime: interval.guestEnd,
          paymentDeadline: input.paymentDeadline,
          amountCents: partyPackage.venueFeeCents as 9500 | 14500,
          rawToken: raw,
        }, tx);
        return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false, acceptTimeToken: raw };
      });
    },

    async acceptPartyTime(input: { bookingId: string; expectedStatus: "time_proposed"; operationId: string; actorUserId: string | null }): Promise<PartyBookingDto> {
      const bookingId = assertUuid(input.bookingId, "bookingId");
      const operationId = assertUuid(input.operationId, "operationId");
      const actorUserId = input.actorUserId === null ? null : assertUuid(input.actorUserId, "actorUserId");
      return db.transaction(async (tx) => {
        const operationPayload = { action: "accept" };
        const transition = await recordTransition({ bookingId, expectedStatus: input.expectedStatus, toStatus: "awaiting_in_store_payment", operationId, actorUserId, actorKind: actorUserId ? "staff" : "customer", operationPayload }, tx);
        if (transition.replayed) return { id: transition.booking.id, status: transition.booking.status, createdAt: transition.booking.createdAt, replayed: true };
        const details = await partyRepo.findDetails(bookingId, tx);
        if (!details?.finalDate || !details.finalSetupStart || !details.finalGuestStart || !details.finalGuestEnd || !details.finalCleanupEnd || !details.paymentDeadline || details.paymentDeadline <= now()) throw new AppError(409, "PARTY_HOLD_EXPIRED", "The proposed party time is no longer available");
        await assertCanHold(bookingId, { date: details.finalDate, setupStart: details.finalSetupStart, cleanupEnd: details.finalCleanupEnd }, tx);
        const updated = await partyRepo.setStatus(bookingId, "time_proposed", "awaiting_in_store_payment", tx);
        if (!updated) throw new AppError(409, "STATUS_CONFLICT", "The party booking changed. Refresh and try again.");
        const event = await eventsRepo.createBooking({ bookingId, operationId, fromStatus: "time_proposed", toStatus: "awaiting_in_store_payment", adminNote: encodePartyOperation(operationPayload), actorUserId, actorKind: actorUserId ? "staff" : "customer" }, tx);
        await enqueuePartyLifecycle({
          booking: updated,
          statusEventId: event.id,
          template: "party_payment_due",
          date: details.finalDate,
          startTime: details.finalGuestStart,
          endTime: details.finalGuestEnd,
          paymentDeadline: details.paymentDeadline,
          amountCents: details.venueFeeCents as 9500 | 14500,
        }, tx);
        return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false };
      });
    },

    async recordPartyPayment(input: {
      bookingId: string;
      expectedStatus: "awaiting_in_store_payment";
      amountCents: 9500 | 14500;
      paidAt: Date;
      operationId: string;
      actorUserId: string;
    }): Promise<PartyBookingDto> {
      const bookingId = assertUuid(input.bookingId, "bookingId");
      const operationId = assertUuid(input.operationId, "operationId");
      const actorUserId = assertUuid(input.actorUserId, "actorUserId");
      if (!(input.paidAt instanceof Date) || Number.isNaN(input.paidAt.getTime())) throw new AppError(400, "VALIDATION_ERROR", "paidAt must be a valid date");
      return db.transaction(async (tx) => {
        const operationPayload = { action: "payment", amountCents: input.amountCents, paidAt: input.paidAt.toISOString() };
        const transition = await recordTransition({ bookingId, expectedStatus: input.expectedStatus, toStatus: "confirmed_paid", operationId, actorUserId, operationPayload }, tx);
        if (transition.replayed) return { id: transition.booking.id, status: transition.booking.status, createdAt: transition.booking.createdAt, replayed: true };
        const details = await partyRepo.findDetails(bookingId, tx);
        if (!details || details.venueFeeCents !== input.amountCents) throw new AppError(400, "PARTY_PAYMENT_AMOUNT_INVALID", "The in-store payment must equal the venue fee");
        if (details.paymentDeadline && details.paymentDeadline <= now()) throw new AppError(409, "PARTY_HOLD_EXPIRED", "The party hold has expired");
        const updated = await partyRepo.setStatus(bookingId, "awaiting_in_store_payment", "confirmed_paid", tx);
        if (!updated) throw new AppError(409, "STATUS_CONFLICT", "The party booking changed. Refresh and try again.");
        await partyRepo.recordPayment(bookingId, input.paidAt, input.amountCents, tx);
        await partyRepo.addCharge({ bookingId, type: "venue_fee", amountCents: input.amountCents, recordedByUserId: actorUserId }, tx);
        const event = await eventsRepo.createBooking({ bookingId, operationId, fromStatus: "awaiting_in_store_payment", toStatus: "confirmed_paid", adminNote: encodePartyOperation(operationPayload), actorUserId }, tx);
        if (!details.finalDate || !details.finalGuestStart || !details.finalGuestEnd) {
          throw new AppError(409, "PARTY_PROPOSAL_INCOMPLETE", "Party final time is required");
        }
        await enqueuePartyLifecycle({
          booking: updated,
          statusEventId: event.id,
          template: "party_payment_recorded",
          date: details.finalDate,
          startTime: details.finalGuestStart,
          endTime: details.finalGuestEnd,
          paymentDeadline: details.paymentDeadline ?? undefined,
          amountCents: input.amountCents,
        }, tx);
        return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false };
      });
    },

    async transitionPartyStatus(input: { bookingId: string; expectedStatus: BookingStatus; toStatus: BookingStatus; operationId: string; actorUserId: string; note?: string }): Promise<PartyBookingDto> {
      const bookingId = assertUuid(input.bookingId, "bookingId");
      const operationId = assertUuid(input.operationId, "operationId");
      const actorUserId = assertUuid(input.actorUserId, "actorUserId");
      if (!PARTY_TRANSITIONS[input.expectedStatus]?.includes(input.toStatus)) throw new AppError(400, "PARTY_DEDICATED_ACTION_REQUIRED", "This party transition requires its dedicated operational action");
      return db.transaction(async (tx) => {
        const operationPayload = { action: "transition", note: input.note?.trim() || null };
        const transition = await recordTransition({ bookingId, expectedStatus: input.expectedStatus, toStatus: input.toStatus, operationId, actorUserId, operationPayload }, tx);
        if (transition.replayed) return { id: transition.booking.id, status: transition.booking.status, createdAt: transition.booking.createdAt, replayed: true };
        const updated = await partyRepo.setStatus(bookingId, input.expectedStatus, input.toStatus, tx);
        if (!updated) throw new AppError(409, "STATUS_CONFLICT", "The party booking changed. Refresh and try again.");
        await eventsRepo.createBooking({ bookingId, operationId, fromStatus: input.expectedStatus, toStatus: input.toStatus, adminNote: encodePartyOperation(operationPayload), actorUserId }, tx);
        return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false };
      });
    },

    async acceptPartyTimeByToken(rawToken: string): Promise<PartyBookingDto> {
      if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) throw invalidLink();
      return db.transaction(async (tx) => {
        const token = await tokensRepo.findActiveByDigest(createHash("sha256").update(rawToken).digest("hex"), now(), tx);
        if (!token || !token.scopes.includes("accept_time")) throw invalidLink();
        const booking = await bookingsRepo.findById(token.bookingId, tx);
        if (!booking || booking.requestKind !== "party" || booking.status !== "time_proposed") throw invalidLink();
        const details = await partyRepo.findDetails(booking.id, tx);
        if (!details?.finalDate || !details.finalSetupStart || !details.finalGuestStart || !details.finalGuestEnd || !details.finalCleanupEnd || !details.paymentDeadline || details.paymentDeadline <= now()) throw invalidLink();
        await assertCanHold(booking.id, { date: details.finalDate, setupStart: details.finalSetupStart, cleanupEnd: details.finalCleanupEnd }, tx);
        const updated = await partyRepo.setStatus(booking.id, "time_proposed", "awaiting_in_store_payment", tx);
        if (!updated) throw invalidLink();
        const consumed = await tokensRepo.consume(token.id, now(), tx);
        if (!consumed) throw invalidLink();
        const operationId = crypto.randomUUID();
        const event = await eventsRepo.createBooking({ bookingId: booking.id, operationId, fromStatus: "time_proposed", toStatus: "awaiting_in_store_payment", actorUserId: null, actorKind: "customer" }, tx);
        if (!event) throw new Error("Party acceptance event was not created");
        await enqueuePartyLifecycle({
          booking: updated,
          statusEventId: event.id,
          template: "party_payment_due",
          date: details.finalDate,
          startTime: details.finalGuestStart,
          endTime: details.finalGuestEnd,
          paymentDeadline: details.paymentDeadline,
          amountCents: details.venueFeeCents as 9500 | 14500,
        }, tx);
        return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false };
      });
    },

    async expirePartyHold(input: { bookingId: string; expectedStatus: "awaiting_in_store_payment"; operationId: string; actorUserId: string | null }): Promise<PartyBookingDto> {
      const bookingId = assertUuid(input.bookingId, "bookingId");
      const operationId = assertUuid(input.operationId, "operationId");
      const actorUserId = input.actorUserId === null
        ? null
        : assertUuid(input.actorUserId, "actorUserId");
      if (input.expectedStatus !== "awaiting_in_store_payment") throw new AppError(400, "VALIDATION_ERROR", "expectedStatus must be awaiting_in_store_payment");
      const expectedStatus = "awaiting_in_store_payment" as const;
      const current = now();
      return db.transaction(async (tx) => {
        const operationPayload = { action: "expiry" };
        const transition = await recordTransition({ bookingId, expectedStatus, toStatus: "payment_expired", operationId, actorUserId, actorKind: actorUserId ? "staff" : "system", operationPayload }, tx);
        if (transition.replayed) return { id: transition.booking.id, status: transition.booking.status, createdAt: transition.booking.createdAt, replayed: true };
        const booking = await bookingsRepo.findById(bookingId, tx);
        if (!booking || booking.requestKind !== "party") throw new AppError(404, "NOT_FOUND", "Party booking not found");
        if (booking.status !== expectedStatus) throw new AppError(409, "STATUS_CONFLICT", "Party hold is not awaiting payment");
        const details = await partyRepo.findDetails(bookingId, tx);
        if (!details?.paymentDeadline || details.paymentDeadline > current) throw new AppError(409, "PARTY_HOLD_NOT_EXPIRED", "Party hold has not expired");
        const updated = await partyRepo.setStatus(bookingId, expectedStatus, "payment_expired", tx);
        if (!updated) throw new AppError(409, "STATUS_CONFLICT", "The party booking changed. Refresh and try again.");
        const event = await eventsRepo.createBooking({ bookingId, operationId, fromStatus: expectedStatus, toStatus: "payment_expired", adminNote: encodePartyOperation(operationPayload), actorUserId, actorKind: actorUserId ? "staff" : "system" }, tx);
        if (!details.finalDate || !details.finalGuestStart || !details.finalGuestEnd) {
          throw new AppError(409, "PARTY_PROPOSAL_INCOMPLETE", "Party final time is required");
        }
        await enqueuePartyLifecycle({
          booking: updated,
          statusEventId: event.id,
          template: "party_payment_expired",
          date: details.finalDate,
          startTime: details.finalGuestStart,
          endTime: details.finalGuestEnd,
          paymentDeadline: details.paymentDeadline,
          amountCents: details.venueFeeCents as 9500 | 14500,
        }, tx);
        return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false };
      });
    },

    async recordPartyCharge(input: { bookingId: string; type: "cake_cutting" | "cleaning" | "overtime"; amountCents: number; note?: string; actorUserId: string }): Promise<void> {
      const bookingId = assertUuid(input.bookingId, "bookingId");
      const actorUserId = assertUuid(input.actorUserId, "actorUserId");
      if (input.type !== "cake_cutting" && input.type !== "cleaning" && input.type !== "overtime") {
        throw new AppError(400, "PARTY_CHARGE_TYPE_INVALID", "Party charge type is invalid");
      }
      const validAmount = input.type === "cake_cutting" ? input.amountCents === 1500 : input.amountCents >= 1500 && input.amountCents <= 3500;
      if (!validAmount) throw new AppError(400, "PARTY_CHARGE_AMOUNT_INVALID", "Party charge amount is invalid");
      await db.transaction(async (tx) => {
        const booking = await bookingsRepo.findById(bookingId, tx);
        if (!booking || booking.requestKind !== "party" || booking.status !== "confirmed_paid") throw new AppError(409, "STATUS_CONFLICT", "Party charges require a paid party booking");
        await partyRepo.addCharge({ bookingId, type: input.type, amountCents: input.amountCents, note: input.note, recordedByUserId: actorUserId }, tx);
      });
    },

    async recordPartyRefund(input: { bookingId: string; expectedStatus: "cancelled"; refundedAt: Date; operationId: string; actorUserId: string }): Promise<PartyBookingDto> {
      const bookingId = assertUuid(input.bookingId, "bookingId");
      const operationId = assertUuid(input.operationId, "operationId");
      const actorUserId = assertUuid(input.actorUserId, "actorUserId");
      if (!(input.refundedAt instanceof Date) || Number.isNaN(input.refundedAt.getTime())) throw new AppError(400, "VALIDATION_ERROR", "refundedAt must be a valid date");
      return db.transaction(async (tx) => {
        const operationPayload = { action: "refund", refundedAt: input.refundedAt.toISOString() };
        const transition = await recordTransition({ bookingId, expectedStatus: "cancelled", toStatus: "refunded", operationId, actorUserId, operationPayload }, tx);
        if (transition.replayed) return { id: transition.booking.id, status: transition.booking.status, createdAt: transition.booking.createdAt, replayed: true };
        const details = await partyRepo.findDetails(bookingId, tx);
        const venueFee = await partyRepo.findCharge(bookingId, "venue_fee", tx);
        if (!details || !venueFee || venueFee.amountCents !== details.venueFeeCents) throw new AppError(409, "PARTY_REFUND_PAYMENT_MISSING", "A recorded venue fee is required before refunding");
        if (!details.finalDate || !details.finalGuestStart) throw new AppError(409, "PARTY_REFUND_INELIGIBLE", "Party final time is required before refunding");
        const cancellation = await eventsRepo.findLatestWithStatus(bookingId, "cancellation_requested", tx);
        if (!cancellation) throw new AppError(409, "PARTY_REFUND_INELIGIBLE", "A customer cancellation request is required before refunding");
        const localStart = melbourneLocalInstant(details.finalDate, details.finalGuestStart);
        if (localStart.getTime() - cancellation.createdAt.getTime() < 48 * 60 * 60 * 1000) throw new AppError(409, "PARTY_REFUND_INELIGIBLE", "Party venue fees are refundable only 48 hours before the guest start");
        const updated = await partyRepo.setStatus(bookingId, "cancelled", "refunded", tx);
        if (!updated) throw new AppError(409, "STATUS_CONFLICT", "The party booking changed. Refresh and try again.");
        await partyRepo.recordRefund(bookingId, input.refundedAt, tx);
        await partyRepo.addCharge({ bookingId, type: "refund", amountCents: details.venueFeeCents, recordedByUserId: actorUserId }, tx);
        await eventsRepo.createBooking({ bookingId, operationId, fromStatus: "cancelled", toStatus: "refunded", adminNote: encodePartyOperation(operationPayload), actorUserId }, tx);
        return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false };
      });
    },
  };
}

export type PartyWorkflowService = ReturnType<typeof createPartyWorkflowService>;
