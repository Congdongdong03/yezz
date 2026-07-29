import {
  bookingPartyDetails,
  bookingCharges,
  bookings,
  customerActionTokens,
  emailOutbox,
  partyPackages,
  requestStatusEvents,
  studioWeeklyHours,
  users,
} from "@yezz/db";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createPartyWorkflowService, decodePartyOperationNote } from "./party-workflow.service.js";
import { createBookingAvailabilityRepository } from "../repositories/booking-availability.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("party workflow PostgreSQL integration", () => {
  let database: RequestFlowTestDatabase;
  let packageId: string;
  let staffId: string;
  let previousActionSecret: string | undefined;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    previousActionSecret = process.env.CUSTOMER_ACTION_TOKEN_SECRET;
    process.env.CUSTOMER_ACTION_TOKEN_SECRET = "test-customer-action-token-secret-32bytes";
    packageId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await database.connection.db.insert(users).values({
      id: staffId,
      email: `staff-${staffId}@example.com`,
      passwordHash: "not-used",
      name: "Staff",
    });
    await database.connection.db.insert(studioWeeklyHours).values(
      Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opensAt: "10:00",
        closesAt: "18:00",
      })),
    );
    await database.connection.db.insert(partyPackages).values({
      id: packageId,
      name: { en: "Ninety-minute party", zh: "九十分钟派对" },
      slug: `party-${packageId}`,
      minPeople: 4,
      maxPeople: 8,
      guestDurationMinutes: 90,
      setupMinutes: 30,
      cleanupMinutes: 30,
      venueFeeCents: 9500,
      minSpendPerPersonCents: 4500,
    });
  });

  afterEach(async () => {
    if (previousActionSecret === undefined) delete process.env.CUSTOMER_ACTION_TOKEN_SECRET;
    else process.env.CUSTOMER_ACTION_TOKEN_SECRET = previousActionSecret;
    await database.close();
  });

  function validParty(overrides: Partial<Parameters<ReturnType<typeof createPartyWorkflowService>["createPartyRequest"]>[0]> = {}) {
    return {
      kind: "party" as const,
      partyPackageId: packageId,
      name: "Mei Lin",
      phone: "0430000000",
      email: "mei@example.com",
      birthdayChildName: "Kai",
      birthdayChildAge: 6,
      participantCount: 4,
      parentCount: 1 as const,
      desiredDate: "2030-08-12",
      desiredStartTime: "12:00",
      projectInterests: ["beads"],
      byoCake: true,
      byoDrinks: true,
      byoFood: false,
      byoSnacks: true,
      cakeCuttingRequested: true,
      locale: "en" as const,
      policyVersion: "2026-07-29" as const,
      policyAccepted: true as const,
      ...overrides,
    };
  }

  it.each([
    { participantCount: 3, parentCount: 1 },
    { participantCount: 9, parentCount: 1 },
    { participantCount: 4, parentCount: 0 },
    { participantCount: 4, parentCount: 3 },
  ])("rejects invalid party attendance %#", async (input) => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });

    await expect(service.createPartyRequest(validParty(input as never), crypto.randomUUID()))
      .rejects.toMatchObject({ code: "PARTY_ATTENDANCE_INVALID" });
  });

  it("creates a pending party request without an exclusive hold", async () => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });

    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
    const [booking] = await database.connection.db.select().from(bookings).where(eq(bookings.id, created.id));
    const [details] = await database.connection.db.select().from(bookingPartyDetails).where(eq(bookingPartyDetails.bookingId, created.id));

    expect(created).toMatchObject({ status: "pending_review", replayed: false });
    expect(booking).toMatchObject({ status: "pending_review", slotDate: null, slotStartTime: null, slotEndTime: null });
    expect(details).toMatchObject({ desiredDate: "2030-08-12", desiredStartTime: "12:00", venueFeeCents: 9500 });
  });

  it("holds setup through cleanup only after acceptance", async () => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });
    const created = await service.createPartyRequest(validParty({ desiredStartTime: "12:00" }), crypto.randomUUID());
    const interval = { date: "2030-08-12", startTime: "12:00", endTime: "14:30" };
    const availability = createBookingAvailabilityRepository(database.connection.db);

    await service.proposePartyTime({
      bookingId: created.id,
      expectedStatus: "pending_review",
      finalDate: "2030-08-12",
      finalGuestStart: "12:30",
      paymentDeadline: new Date("2030-08-11T00:00:00.000Z"),
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    });
    expect(await availability.hasExclusivePartyOverlap(interval)).toBe(false);

    await service.acceptPartyTime({
      bookingId: created.id,
      expectedStatus: "time_proposed",
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    });

    expect(await availability.hasExclusivePartyOverlap(interval)).toBe(true);
  });

  it("records only the configured in-store venue fee once", async () => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });
    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
    await service.proposePartyTime({
      bookingId: created.id,
      expectedStatus: "pending_review",
      finalDate: "2030-08-12",
      finalGuestStart: "12:00",
      paymentDeadline: new Date("2030-08-11T00:00:00.000Z"),
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    });

    await expect(service.recordPartyPayment({
      bookingId: created.id,
      expectedStatus: "awaiting_in_store_payment",
      amountCents: 14500,
      paidAt: new Date("2030-08-10T02:00:00.000Z"),
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    })).rejects.toMatchObject({ code: "PARTY_PAYMENT_AMOUNT_INVALID" });

    const paymentOperationId = crypto.randomUUID();
    const paymentInput = {
      bookingId: created.id,
      expectedStatus: "awaiting_in_store_payment",
      amountCents: 9500,
      paidAt: new Date("2030-08-10T02:00:00.000Z"),
      operationId: paymentOperationId,
      actorUserId: staffId,
    } as const;
    const paid = await service.recordPartyPayment(paymentInput);
    expect(paid.status).toBe("confirmed_paid");
    expect(await database.connection.db.select().from(bookingCharges).where(eq(bookingCharges.bookingId, created.id))).toMatchObject([
      { type: "venue_fee", amountCents: 9500 },
    ]);
    await expect(service.recordPartyPayment(paymentInput)).resolves.toMatchObject({ replayed: true });
    await expect(service.recordPartyPayment({ ...paymentInput, amountCents: 14500 })).rejects.toMatchObject({ code: "OPERATION_ID_CONFLICT" });
    await expect(service.recordPartyPayment({ ...paymentInput, operationId: crypto.randomUUID() })).rejects.toMatchObject({ code: "STATUS_CONFLICT" });
  });

  it("rejects direct generic transitions that bypass party operational invariants", async () => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });
    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());

    await expect(service.transitionPartyStatus({
      bookingId: created.id,
      expectedStatus: "pending_review",
      toStatus: "awaiting_in_store_payment",
      operationId: crypto.randomUUID(),
      actorUserId: staffId,
    })).rejects.toMatchObject({ code: "PARTY_DEDICATED_ACTION_REQUIRED" });
  });

  it("replays an identical proposal with the same accept token and rejects a changed proposal payload", async () => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });
    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
    const operationId = crypto.randomUUID();
    const proposal = {
      bookingId: created.id,
      expectedStatus: "pending_review" as const,
      finalDate: "2030-08-12",
      finalGuestStart: "12:30",
      paymentDeadline: new Date("2030-08-11T00:00:00.000Z"),
      operationId,
      actorUserId: staffId,
    };
    const first = await service.proposePartyTime(proposal);
    const [persistedToken] = await database.connection.db.select().from(customerActionTokens).where(eq(customerActionTokens.bookingId, created.id));
    const replay = await service.proposePartyTime(proposal);

    expect(first.acceptTimeToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(replay).toMatchObject({ id: created.id, replayed: true });
    expect(replay.acceptTimeToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(replay.acceptTimeToken).toBe(first.acceptTimeToken);
    const [replayedToken] = await database.connection.db.select().from(customerActionTokens).where(eq(customerActionTokens.bookingId, created.id));
    expect(replayedToken).toMatchObject({ id: persistedToken?.id, tokenDigest: persistedToken?.tokenDigest, revokedAt: persistedToken?.revokedAt });
    const previousOwnerEmail = process.env.OWNER_EMAIL;
    process.env.OWNER_EMAIL = "owner@example.com";
    try {
      await expect(service.acceptPartyTimeByToken(first.acceptTimeToken!)).resolves.toMatchObject({ status: "awaiting_in_store_payment" });
    } finally {
      if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
      else process.env.OWNER_EMAIL = previousOwnerEmail;
    }
    await expect(service.proposePartyTime({ ...proposal, finalGuestStart: "13:00" }))
      .rejects.toMatchObject({ code: "OPERATION_ID_CONFLICT" });
  });

  it("does not reissue a proposal credential after acceptance or its deadline", async () => {
    let current = new Date("2030-08-10T00:00:00.000Z");
    const service = createPartyWorkflowService(database.connection.db, { now: () => current });
    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
    const proposal = { bookingId: created.id, expectedStatus: "pending_review" as const, finalDate: "2030-08-12", finalGuestStart: "12:30", paymentDeadline: new Date("2030-08-10T01:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId };
    const issued = await service.proposePartyTime(proposal);
    await service.acceptPartyTime({ bookingId: created.id, expectedStatus: "time_proposed", operationId: crypto.randomUUID(), actorUserId: staffId });
    const acceptedReplay = await service.proposePartyTime(proposal);
    expect(acceptedReplay.replayed).toBe(true);
    expect(acceptedReplay.acceptTimeToken).toBeUndefined();
    const expired = await service.createPartyRequest(validParty({ email: "expired@example.com" }), crypto.randomUUID());
    const expiredProposal = { ...proposal, bookingId: expired.id, operationId: crypto.randomUUID() };
    await service.proposePartyTime(expiredProposal);
    current = new Date("2030-08-10T02:00:00.000Z");
    const expiredReplay = await service.proposePartyTime(expiredProposal);
    expect(expiredReplay.replayed).toBe(true);
    expect(expiredReplay.acceptTimeToken).toBeUndefined();
    expect(issued.acceptTimeToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("rejects a changed party request that reuses an idempotency key", async () => {
    const service = createPartyWorkflowService(database.connection.db, {
      now: () => new Date("2030-08-10T00:00:00.000Z"),
    });
    const key = crypto.randomUUID();
    const created = await service.createPartyRequest(validParty(), key);

    await expect(service.createPartyRequest(validParty({ participantCount: 5 }), key))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_CONFLICT" });
    await expect(service.createPartyRequest(validParty(), key))
      .resolves.toMatchObject({ id: created.id, replayed: true });
  });

  it("replays whitespace-normalized project interests and rejects a cross-kind idempotency collision", async () => {
    const service = createPartyWorkflowService(database.connection.db, { now: () => new Date("2030-08-10T00:00:00.000Z") });
    const key = crypto.randomUUID();
    const input = validParty({ projectInterests: ["  beads  ", " clay "] });
    await service.createPartyRequest(input, key);
    await expect(service.createPartyRequest(input, key)).resolves.toMatchObject({ replayed: true });
    const collisionKey = crypto.randomUUID();
    await database.connection.db.insert(bookings).values({ name: "Ordinary", phone: "0430000033", requestKind: "experience", idempotencyKey: collisionKey });
    await expect(service.createPartyRequest(validParty(), collisionKey)).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_CONFLICT" });
  });

  it("keeps pending and proposed parties non-blocking but blocks a second active hold across setup", async () => {
    const service = createPartyWorkflowService(database.connection.db, { now: () => new Date("2030-08-10T00:00:00.000Z") });
    const availability = createBookingAvailabilityRepository(database.connection.db);
    const first = await service.createPartyRequest(validParty(), crypto.randomUUID());
    await expect(availability.hasExclusivePartyOverlap({ date: "2030-08-12", startTime: "11:30", endTime: "14:00" })).resolves.toBe(false);
    await service.proposePartyTime({ bookingId: first.id, expectedStatus: "pending_review", finalDate: "2030-08-12", finalGuestStart: "12:30", paymentDeadline: new Date("2030-08-11T00:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
    await expect(availability.hasExclusivePartyOverlap({ date: "2030-08-12", startTime: "12:00", endTime: "14:30" })).resolves.toBe(false);
    const second = await service.createPartyRequest(validParty({ email: "second@example.com", desiredStartTime: "13:30" }), crypto.randomUUID());
    await service.proposePartyTime({ bookingId: second.id, expectedStatus: "pending_review", finalDate: "2030-08-12", finalGuestStart: "14:00", paymentDeadline: new Date("2030-08-11T00:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
    await service.acceptPartyTime({ bookingId: first.id, expectedStatus: "time_proposed", operationId: crypto.randomUUID(), actorUserId: staffId });
    await expect(service.acceptPartyTime({ bookingId: second.id, expectedStatus: "time_proposed", operationId: crypto.randomUUID(), actorUserId: staffId })).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
  });

  it("expires an overdue hold with the trusted service clock and releases its interval", async () => {
    let current = new Date("2030-08-10T00:00:00.000Z");
    const service = createPartyWorkflowService(database.connection.db, { now: () => current });
    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
    await service.proposePartyTime({ bookingId: created.id, expectedStatus: "pending_review", finalDate: "2030-08-12", finalGuestStart: "12:00", paymentDeadline: new Date("2030-08-10T01:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
    const interval = { date: "2030-08-12", startTime: "11:30", endTime: "14:00" };
    await expect(createBookingAvailabilityRepository(database.connection.db).hasExclusivePartyOverlap(interval)).resolves.toBe(true);
    current = new Date("2030-08-10T02:00:00.000Z");
    await expect(service.expirePartyHold({ bookingId: created.id, expectedStatus: "awaiting_in_store_payment", operationId: crypto.randomUUID(), actorUserId: staffId })).resolves.toMatchObject({ status: "payment_expired" });
    await expect(createBookingAvailabilityRepository(database.connection.db).hasExclusivePartyOverlap(interval)).resolves.toBe(false);
    await expect(service.recordPartyPayment({ bookingId: created.id, expectedStatus: "awaiting_in_store_payment", amountCents: 9500, paidAt: current, operationId: crypto.randomUUID(), actorUserId: staffId })).rejects.toMatchObject({ code: "STATUS_CONFLICT" });
    await expect(service.expirePartyHold({ bookingId: created.id, expectedStatus: "confirmed_paid" as never, operationId: crypto.randomUUID(), actorUserId: staffId })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("consumes a valid accept token with one status event and two deduplicated emails", async () => {
    const previousOwnerEmail = process.env.OWNER_EMAIL;
    process.env.OWNER_EMAIL = "owner@example.com";
    try {
      const service = createPartyWorkflowService(database.connection.db, { now: () => new Date("2030-08-10T00:00:00.000Z") });
      const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
      const proposal = await service.proposePartyTime({ bookingId: created.id, expectedStatus: "pending_review", finalDate: "2030-08-12", finalGuestStart: "12:30", paymentDeadline: new Date("2030-08-11T00:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
      await expect(service.acceptPartyTimeByToken(proposal.acceptTimeToken!)).resolves.toMatchObject({ status: "awaiting_in_store_payment" });
      const tokens = await database.connection.db.select().from(customerActionTokens).where(eq(customerActionTokens.bookingId, created.id));
      const events = await database.connection.db.select().from(requestStatusEvents).where(eq(requestStatusEvents.bookingId, created.id));
      const emails = await database.connection.db.select().from(emailOutbox).where(eq(emailOutbox.bookingId, created.id));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.revokedAt).not.toBeNull();
      expect(events.filter((event) => event.toStatus === "awaiting_in_store_payment")).toHaveLength(1);
      expect(emails).toHaveLength(2);
      await expect(service.acceptPartyTimeByToken(proposal.acceptTimeToken!)).rejects.toMatchObject({ code: "LINK_INVALID_OR_EXPIRED" });
      await expect(service.acceptPartyTimeByToken("x".repeat(43))).rejects.toMatchObject({ code: "LINK_INVALID_OR_EXPIRED" });
    } finally {
      if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
      else process.env.OWNER_EMAIL = previousOwnerEmail;
    }
  });

  it("returns the same generic invalid-link error for wrong-scope, wrong-state, and expired accept tokens", async () => {
    const now = new Date("2030-08-10T00:00:00.000Z");
    const service = createPartyWorkflowService(database.connection.db, { now: () => now });
    const booking = await service.createPartyRequest(validParty(), crypto.randomUUID());
    const tokens = [
      { raw: "s".repeat(43), scopes: ["request_cancellation"], expiresAt: new Date("2030-08-11T00:00:00.000Z") },
      { raw: "t".repeat(43), scopes: ["accept_time"], expiresAt: new Date("2030-08-11T00:00:00.000Z") },
      { raw: "u".repeat(43), scopes: ["accept_time"], expiresAt: new Date("2030-08-09T00:00:00.000Z") },
    ] as const;
    await database.connection.db.insert(customerActionTokens).values(tokens.map((token) => ({ bookingId: booking.id, tokenDigest: createHash("sha256").update(token.raw).digest("hex"), scopes: [...token.scopes], expiresAt: token.expiresAt })));
    for (const token of tokens) {
      await expect(service.acceptPartyTimeByToken(token.raw)).rejects.toMatchObject({ code: "LINK_INVALID_OR_EXPIRED" });
    }
  });

  it("rolls back token consumption and status when acceptance email enqueue cannot be completed", async () => {
    const previousOwnerEmail = process.env.OWNER_EMAIL;
    delete process.env.OWNER_EMAIL;
    try {
      const service = createPartyWorkflowService(database.connection.db, { now: () => new Date("2030-08-10T00:00:00.000Z") });
      const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
      const proposal = await service.proposePartyTime({ bookingId: created.id, expectedStatus: "pending_review", finalDate: "2030-08-12", finalGuestStart: "12:30", paymentDeadline: new Date("2030-08-11T00:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
      await expect(service.acceptPartyTimeByToken(proposal.acceptTimeToken!)).rejects.toMatchObject({ code: "OWNER_EMAIL_UNAVAILABLE" });
      const [booking] = await database.connection.db.select().from(bookings).where(eq(bookings.id, created.id));
      const [token] = await database.connection.db.select().from(customerActionTokens).where(eq(customerActionTokens.bookingId, created.id));
      expect(booking?.status).toBe("time_proposed");
      expect(token?.revokedAt).toBeNull();
    } finally {
      if (previousOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
      else process.env.OWNER_EMAIL = previousOwnerEmail;
    }
  });

  it("accepts only the configured variable party charge types and ranges", async () => {
    const service = createPartyWorkflowService(database.connection.db, { now: () => new Date("2030-08-10T00:00:00.000Z") });
    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
    await service.proposePartyTime({ bookingId: created.id, expectedStatus: "pending_review", finalDate: "2030-08-12", finalGuestStart: "12:00", paymentDeadline: new Date("2030-08-11T00:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
    await service.recordPartyPayment({ bookingId: created.id, expectedStatus: "awaiting_in_store_payment", amountCents: 9500, paidAt: new Date("2030-08-10T01:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
    await expect(service.recordPartyCharge({ bookingId: created.id, type: "cake_cutting", amountCents: 1500, actorUserId: staffId })).resolves.toBeUndefined();
    await expect(service.recordPartyCharge({ bookingId: created.id, type: "cleaning", amountCents: 1500, actorUserId: staffId })).resolves.toBeUndefined();
    await expect(service.recordPartyCharge({ bookingId: created.id, type: "overtime", amountCents: 3500, actorUserId: staffId })).resolves.toBeUndefined();
    await expect(service.recordPartyCharge({ bookingId: created.id, type: "cleaning", amountCents: 1499, actorUserId: staffId })).rejects.toMatchObject({ code: "PARTY_CHARGE_AMOUNT_INVALID" });
    await expect(service.recordPartyCharge({ bookingId: created.id, type: "overtime", amountCents: 3501, actorUserId: staffId })).rejects.toMatchObject({ code: "PARTY_CHARGE_AMOUNT_INVALID" });
    await expect(service.recordPartyCharge({ bookingId: created.id, type: "venue_fee" as never, amountCents: 1500, actorUserId: staffId })).rejects.toMatchObject({ code: "PARTY_CHARGE_TYPE_INVALID" });
    await expect(service.recordPartyCharge({ bookingId: created.id, type: "refund" as never, amountCents: 1500, actorUserId: staffId })).rejects.toMatchObject({ code: "PARTY_CHARGE_TYPE_INVALID" });
    await expect(service.recordPartyCharge({ bookingId: created.id, type: "invented" as never, amountCents: 1500, actorUserId: staffId })).rejects.toMatchObject({ code: "PARTY_CHARGE_TYPE_INVALID" });
  });

  it("keeps a legacy confirmed party blocking until reconciliation", async () => {
    await database.connection.db.insert(bookings).values({
      id: crypto.randomUUID(), name: "Legacy", phone: "0430000099", requestKind: "party",
      partyPackageId: packageId, status: "confirmed", slotDate: "2030-08-12",
      slotStartTime: "11:30", slotEndTime: "14:00",
    });
    const service = createPartyWorkflowService(database.connection.db, { now: () => new Date("2030-08-10T00:00:00.000Z") });
    const created = await service.createPartyRequest(validParty({ email: "new@example.com", desiredStartTime: "12:00" }), crypto.randomUUID());
    await service.proposePartyTime({ bookingId: created.id, expectedStatus: "pending_review", finalDate: "2030-08-12", finalGuestStart: "12:30", paymentDeadline: new Date("2030-08-11T00:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
    await expect(service.acceptPartyTime({ bookingId: created.id, expectedStatus: "time_proposed", operationId: crypto.randomUUID(), actorUserId: staffId })).rejects.toMatchObject({ code: "CAPACITY_CONFLICT" });
  });

  it("requires a cancellation request before refunding and rejects a second refund", async () => {
    const service = createPartyWorkflowService(database.connection.db, { now: () => new Date("2030-08-10T00:00:00.000Z") });
    const created = await service.createPartyRequest(validParty(), crypto.randomUUID());
    await service.proposePartyTime({ bookingId: created.id, expectedStatus: "pending_review", finalDate: "2030-08-12", finalGuestStart: "12:00", paymentDeadline: new Date("2030-08-11T00:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
    await service.recordPartyPayment({ bookingId: created.id, expectedStatus: "awaiting_in_store_payment", amountCents: 9500, paidAt: new Date("2030-08-10T01:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
    await database.connection.db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, created.id));
    await expect(service.recordPartyRefund({ bookingId: created.id, expectedStatus: "cancelled", refundedAt: new Date("2030-08-10T02:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId })).rejects.toMatchObject({ code: "PARTY_REFUND_INELIGIBLE" });
    await database.connection.db.update(bookings).set({ status: "confirmed_paid" }).where(eq(bookings.id, created.id));
    const cancellationOperationId = crypto.randomUUID();
    await service.transitionPartyStatus({ bookingId: created.id, expectedStatus: "confirmed_paid", toStatus: "cancellation_requested", operationId: cancellationOperationId, actorUserId: staffId, note: "Customer asked to cancel" });
    await expect(service.transitionPartyStatus({ bookingId: created.id, expectedStatus: "confirmed_paid", toStatus: "cancellation_requested", operationId: cancellationOperationId, actorUserId: staffId, note: "Customer asked to cancel" })).resolves.toMatchObject({ replayed: true });
    await expect(service.transitionPartyStatus({ bookingId: created.id, expectedStatus: "confirmed_paid", toStatus: "cancellation_requested", operationId: cancellationOperationId, actorUserId: staffId, note: "Changed note" })).rejects.toMatchObject({ code: "OPERATION_ID_CONFLICT" });
    await service.transitionPartyStatus({ bookingId: created.id, expectedStatus: "cancellation_requested", toStatus: "cancelled", operationId: crypto.randomUUID(), actorUserId: staffId });
    const refundOperationId = crypto.randomUUID();
    const refundInput = { bookingId: created.id, expectedStatus: "cancelled" as const, refundedAt: new Date("2030-08-10T02:00:00.000Z"), operationId: refundOperationId, actorUserId: staffId };
    const refunded = await service.recordPartyRefund(refundInput);
    expect(refunded.status).toBe("refunded");
    await expect(service.recordPartyRefund(refundInput)).resolves.toMatchObject({ replayed: true });
    await expect(service.recordPartyRefund({ ...refundInput, refundedAt: new Date("2030-08-10T03:00:00.000Z") })).rejects.toMatchObject({ code: "OPERATION_ID_CONFLICT" });
    await expect(service.recordPartyRefund({ ...refundInput, operationId: crypto.randomUUID() })).rejects.toMatchObject({ code: "STATUS_CONFLICT" });
  });

  it("uses Melbourne instants at the exact 48-hour refund boundary across DST", async () => {
    const service = createPartyWorkflowService(database.connection.db, { now: () => new Date("2030-08-10T00:00:00.000Z") });
    async function cancelledPaidParty(email: string, cancellationAt: Date) {
      const created = await service.createPartyRequest(validParty({ email }), crypto.randomUUID());
      await service.proposePartyTime({ bookingId: created.id, expectedStatus: "pending_review", finalDate: "2030-08-12", finalGuestStart: "12:00", paymentDeadline: new Date("2030-08-11T00:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
      await service.recordPartyPayment({ bookingId: created.id, expectedStatus: "awaiting_in_store_payment", amountCents: 9500, paidAt: new Date("2030-08-10T01:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId });
      await service.transitionPartyStatus({ bookingId: created.id, expectedStatus: "confirmed_paid", toStatus: "cancellation_requested", operationId: crypto.randomUUID(), actorUserId: staffId });
      await service.transitionPartyStatus({ bookingId: created.id, expectedStatus: "cancellation_requested", toStatus: "cancelled", operationId: crypto.randomUUID(), actorUserId: staffId });
      await database.connection.db.update(bookingPartyDetails).set({ finalDate: "2030-10-06", finalGuestStart: "12:00" }).where(eq(bookingPartyDetails.bookingId, created.id));
      await database.connection.db.update(requestStatusEvents).set({ createdAt: cancellationAt }).where(eq(requestStatusEvents.bookingId, created.id));
      return created.id;
    }
    const exact = await cancelledPaidParty("dst-exact@example.com", new Date("2030-10-04T01:00:00.000Z"));
    await expect(service.recordPartyRefund({ bookingId: exact, expectedStatus: "cancelled", refundedAt: new Date("2030-10-04T02:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId })).resolves.toMatchObject({ status: "refunded" });
    const under = await cancelledPaidParty("dst-under@example.com", new Date("2030-10-04T01:01:00.000Z"));
    await expect(service.recordPartyRefund({ bookingId: under, expectedStatus: "cancelled", refundedAt: new Date("2030-10-04T02:00:00.000Z"), operationId: crypto.randomUUID(), actorUserId: staffId })).rejects.toMatchObject({ code: "PARTY_REFUND_INELIGIBLE" });
  });
});

describe("party operation history note decoder", () => {
  it("returns only a submitted human note and hides operational JSON", () => {
    expect(decodePartyOperationNote('{"partyWorkflow":1,"action":"payment"}')).toEqual({ note: null });
    expect(decodePartyOperationNote('{"partyWorkflow":1,"action":"transition","note":"Called customer"}')).toEqual({ note: "Called customer" });
  });
});
