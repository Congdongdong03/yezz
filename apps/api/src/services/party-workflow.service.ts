import type { BookingStatus, Db } from "@yezz/db";
import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../lib/errors.js";
import { getMelbourneClock, parseCalendarDate, validateBookingWindow } from "../lib/booking-policy.js";
import { createBookingAvailabilityRepository } from "../repositories/booking-availability.repository.js";
import { createBookingsRepository } from "../repositories/bookings.repository.js";
import { createCustomerActionTokensRepository } from "../repositories/customer-action-tokens.repository.js";
import { createEmailOutboxRepository } from "../repositories/email-outbox.repository.js";
import { createPartiesRepository } from "../repositories/parties.repository.js";
import { createPartyWorkflowRepository } from "../repositories/party-workflow.repository.js";
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

export function createPartyWorkflowService(db: Db, dependencies?: { now?: () => Date }) {
  const bookingsRepo = createBookingsRepository(db);
  const partiesRepo = createPartiesRepository(db);
  const partyRepo = createPartyWorkflowRepository(db);
  const scheduleRepo = createStudioScheduleRepository(db);
  const availabilityRepo = createBookingAvailabilityRepository(db);
  const tokensRepo = createCustomerActionTokensRepository(db);
  const eventsRepo = createStatusEventsRepository(db);
  const outboxRepo = createEmailOutboxRepository(db);
  const now = dependencies?.now ?? (() => new Date());

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

  function ownerEmail(): string {
    const value = process.env.OWNER_EMAIL?.trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new AppError(503, "OWNER_EMAIL_UNAVAILABLE", "Booking notifications are temporarily unavailable");
    return value;
  }

  async function enqueueAcceptanceEmails(booking: { id: string; name: string; email: string | null; locale: string | null }, tx: Db) {
    const owner = ownerEmail();
    const fields = [
      { label: "Customer", value: booking.name },
      { label: "Status", value: "Time accepted; venue fee is due in store" },
    ];
    if (booking.email) await outboxRepo.enqueue({
      dedupeKey: `booking:${booking.id}:party-time-accepted:customer`,
      bookingId: booking.id,
      messageType: "booking_received_owner",
      recipient: booking.email,
      locale: booking.locale?.startsWith("zh") ? "zh" : "en",
      payload: { template: "owner_request", subject: "YezYY party time accepted", heading: "Party time accepted", fields },
    }, tx);
    await outboxRepo.enqueue({
      dedupeKey: `booking:${booking.id}:party-time-accepted:owner`,
      bookingId: booking.id,
      messageType: "booking_received_owner",
      recipient: owner,
      locale: "en",
      payload: { template: "owner_request", subject: "Party time accepted", heading: "Party time accepted", fields },
    }, tx);
  }

  async function assertPartyReplay(booking: Awaited<ReturnType<typeof bookingsRepo.findByIdempotencyKey>> & {}, input: PartyCreateInput, packageId: string, tx: Db = db): Promise<void> {
    if (!booking || booking.requestKind !== "party" || booking.partyPackageId !== packageId) {
      throw new AppError(409, "IDEMPOTENCY_KEY_CONFLICT", "The idempotency key belongs to a different booking request");
    }
    const details = await partyRepo.findDetails(booking.id, tx);
    const same = Boolean(details) &&
      booking.name === input.name.trim() && booking.phone === input.phone.trim() && booking.email === input.email.trim().toLowerCase() &&
      booking.locale === input.locale && booking.policyVersion === input.policyVersion && Boolean(booking.policyAcceptedAt) &&
      booking.interestedProject === input.projectInterests.map((value) => value.trim()).join(", ") && booking.message === (input.specialRequirements?.trim() || null) &&
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
      const key = assertUuid(idempotencyKey, "Idempotency-Key");
      const packageId = assertUuid(input.partyPackageId, "partyPackageId");
      const existing = await bookingsRepo.findByIdempotencyKey(key);
      if (existing) {
        await assertPartyReplay(existing, input, packageId);
        return { id: existing.id, status: existing.status, createdAt: existing.createdAt, replayed: true };
      }
      return db.transaction(async (tx) => {
        await bookingsRepo.lockCreateAttempt(key, tx);
        const replay = await bookingsRepo.findByIdempotencyKey(key, tx);
        if (replay) {
          await assertPartyReplay(replay, input, packageId, tx);
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
        const schedule = await scheduleRepo.resolveDay(input.desiredDate);
        if (schedule.isClosed || !schedule.opensAt || !schedule.closesAt) throw new AppError(400, "STUDIO_CLOSED", "The studio is closed on this date");
        validateBookingWindow({ date: input.desiredDate, startTime: input.desiredStartTime, durationMinutes: partyPackage.guestDurationMinutes }, getMelbourneClock(now()), { opensAt: schedule.opensAt, closesAt: schedule.closesAt });
        const row = await partyRepo.createRequest({
          ...input,
          partyPackageId: packageId,
          idempotencyKey: key,
          offeringNameSnapshot: partyPackage.name,
          venueFeeCents: partyPackage.venueFeeCents!,
          minSpendPerPersonCents: partyPackage.minSpendPerPersonCents!,
        }, tx);
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
            const raw = randomBytes(32).toString("base64url");
            await tokensRepo.revokeActiveAcceptTimeTokens(bookingId, now(), tx);
            await tokensRepo.create({ bookingId, tokenDigest: createHash("sha256").update(raw).digest("hex"), scopes: ["accept_time"], expiresAt: details.paymentDeadline }, tx);
            return { id: replay.id, status: replay.status, createdAt: replay.createdAt, replayed: true, acceptTimeToken: raw };
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
        await eventsRepo.createBooking({ bookingId, operationId, fromStatus: input.expectedStatus, toStatus: target, adminNote: encodePartyOperation(operationPayload), actorUserId }, tx);
        if (target === "awaiting_in_store_payment") return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false };
        const raw = randomBytes(32).toString("base64url");
        await tokensRepo.revokeActiveAcceptTimeTokens(bookingId, now(), tx);
        await tokensRepo.create({ bookingId, tokenDigest: createHash("sha256").update(raw).digest("hex"), scopes: ["accept_time"], expiresAt: input.paymentDeadline }, tx);
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
        await eventsRepo.createBooking({ bookingId, operationId, fromStatus: "time_proposed", toStatus: "awaiting_in_store_payment", adminNote: encodePartyOperation(operationPayload), actorUserId, actorKind: actorUserId ? "staff" : "customer" }, tx);
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
        await eventsRepo.createBooking({ bookingId, operationId, fromStatus: "awaiting_in_store_payment", toStatus: "confirmed_paid", adminNote: encodePartyOperation(operationPayload), actorUserId }, tx);
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
        if (!details?.finalDate || !details.finalSetupStart || !details.finalCleanupEnd || !details.paymentDeadline || details.paymentDeadline <= now()) throw invalidLink();
        await assertCanHold(booking.id, { date: details.finalDate, setupStart: details.finalSetupStart, cleanupEnd: details.finalCleanupEnd }, tx);
        const updated = await partyRepo.setStatus(booking.id, "time_proposed", "awaiting_in_store_payment", tx);
        if (!updated) throw invalidLink();
        const consumed = await tokensRepo.consume(token.id, now(), tx);
        if (!consumed) throw invalidLink();
        const operationId = crypto.randomUUID();
        const event = await eventsRepo.createBooking({ bookingId: booking.id, operationId, fromStatus: "time_proposed", toStatus: "awaiting_in_store_payment", actorUserId: null, actorKind: "customer" }, tx);
        if (!event) throw new Error("Party acceptance event was not created");
        await enqueueAcceptanceEmails(updated, tx);
        return { id: updated.id, status: updated.status, createdAt: updated.createdAt, replayed: false };
      });
    },

    async expirePartyHold(input: { bookingId: string; expectedStatus: "awaiting_in_store_payment"; operationId: string; actorUserId: string }): Promise<PartyBookingDto> {
      const bookingId = assertUuid(input.bookingId, "bookingId");
      const operationId = assertUuid(input.operationId, "operationId");
      const actorUserId = assertUuid(input.actorUserId, "actorUserId");
      const current = now();
      return db.transaction(async (tx) => {
        const operationPayload = { action: "expiry" };
        const transition = await recordTransition({ bookingId, expectedStatus: input.expectedStatus, toStatus: "payment_expired", operationId, actorUserId, operationPayload }, tx);
        if (transition.replayed) return { id: transition.booking.id, status: transition.booking.status, createdAt: transition.booking.createdAt, replayed: true };
        const booking = await bookingsRepo.findById(bookingId, tx);
        if (!booking || booking.requestKind !== "party") throw new AppError(404, "NOT_FOUND", "Party booking not found");
        if (booking.status !== input.expectedStatus) throw new AppError(409, "STATUS_CONFLICT", "Party hold is not awaiting payment");
        const details = await partyRepo.findDetails(bookingId, tx);
        if (!details?.paymentDeadline || details.paymentDeadline > current) throw new AppError(409, "PARTY_HOLD_NOT_EXPIRED", "Party hold has not expired");
        const updated = await partyRepo.setStatus(bookingId, input.expectedStatus, "payment_expired", tx);
        if (!updated) throw new AppError(409, "STATUS_CONFLICT", "The party booking changed. Refresh and try again.");
        await eventsRepo.createBooking({ bookingId, operationId, fromStatus: input.expectedStatus, toStatus: "payment_expired", adminNote: encodePartyOperation(operationPayload), actorUserId }, tx);
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
