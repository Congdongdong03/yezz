import {
  bookingCharges,
  bookingPartyDetails,
  bookings,
  type BookingChargeType,
  type BookingStatus,
  type Db,
  type LocalizedString,
} from "@yezz/db";
import { and, eq } from "drizzle-orm";

export type PartyRequestInsert = {
  partyPackageId: string;
  name: string;
  phone: string;
  email: string;
  birthdayChildName: string;
  birthdayChildAge: number;
  participantCount: number;
  parentCount: number;
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
  policyVersion: string;
  idempotencyKey: string;
  offeringNameSnapshot: LocalizedString;
  venueFeeCents: number;
  minSpendPerPersonCents: number;
};

export function createPartyWorkflowRepository(db: Db) {
  return {
    async createRequest(input: PartyRequestInsert, tx: Db = db) {
      const [booking] = await tx.insert(bookings).values({
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email.trim().toLowerCase(),
        preferredDate: input.desiredDate,
        numberOfPeople: input.participantCount + input.parentCount,
        activityType: "party",
        interestedProject: input.projectInterests.join(", "),
        message: input.specialRequirements?.trim() || null,
        locale: input.locale,
        requestKind: "party",
        partyPackageId: input.partyPackageId,
        offeringNameSnapshot: input.offeringNameSnapshot,
        slotTimezone: "Australia/Melbourne",
        idempotencyKey: input.idempotencyKey,
        status: "pending_review",
        participantCount: input.participantCount,
        attendanceCount: input.participantCount + input.parentCount,
        policyVersion: input.policyVersion,
        policyAcceptedAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      if (!booking) throw new Error("Party booking insert did not return a row");
      await tx.insert(bookingPartyDetails).values({
        bookingId: booking.id,
        birthdayChildName: input.birthdayChildName.trim(),
        birthdayChildAge: input.birthdayChildAge,
        participantCount: input.participantCount,
        parentCount: input.parentCount,
        desiredDate: input.desiredDate,
        desiredStartTime: input.desiredStartTime,
        byoCake: input.byoCake,
        byoDrinks: input.byoDrinks,
        byoFood: input.byoFood,
        byoSnacks: input.byoSnacks,
        cakeCuttingRequested: input.cakeCuttingRequested,
        specialRequirements: input.specialRequirements?.trim() || null,
        venueFeeCents: input.venueFeeCents,
        minSpendPerPersonCents: input.minSpendPerPersonCents,
      });
      return booking;
    },

    async findDetails(bookingId: string, tx: Db = db) {
      const [row] = await tx.select().from(bookingPartyDetails)
        .where(eq(bookingPartyDetails.bookingId, bookingId)).limit(1);
      return row ?? null;
    },

    async setProposal(input: {
      bookingId: string;
      expectedStatus: BookingStatus;
      date: string;
      setupStart: string;
      guestStart: string;
      guestEnd: string;
      cleanupEnd: string;
      paymentDeadline: Date;
      status: "time_proposed" | "awaiting_in_store_payment";
    }, tx: Db = db) {
      const [booking] = await tx.update(bookings).set({
        status: input.status,
        preferredDate: input.date,
        slotDate: input.date,
        slotStartTime: input.setupStart,
        slotEndTime: input.cleanupEnd,
        durationMinutes: null,
        updatedAt: new Date(),
      }).where(and(eq(bookings.id, input.bookingId), eq(bookings.status, input.expectedStatus))).returning();
      if (!booking) return null;
      await tx.update(bookingPartyDetails).set({
        finalDate: input.date,
        finalSetupStart: input.setupStart,
        finalGuestStart: input.guestStart,
        finalGuestEnd: input.guestEnd,
        finalCleanupEnd: input.cleanupEnd,
        paymentDeadline: input.paymentDeadline,
      }).where(eq(bookingPartyDetails.bookingId, input.bookingId));
      return booking;
    },

    async setStatus(bookingId: string, expectedStatus: BookingStatus, status: BookingStatus, tx: Db = db) {
      const [row] = await tx.update(bookings).set({ status, updatedAt: new Date() })
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, expectedStatus))).returning();
      return row ?? null;
    },

    async recordPayment(bookingId: string, paidAt: Date, amountCents: number, tx: Db = db) {
      await tx.update(bookingPartyDetails).set({ paidAt, paidAmountCents: amountCents })
        .where(eq(bookingPartyDetails.bookingId, bookingId));
    },

    async recordRefund(bookingId: string, refundedAt: Date, tx: Db = db) {
      await tx.update(bookingPartyDetails).set({ refundedAt })
        .where(eq(bookingPartyDetails.bookingId, bookingId));
    },

    async addCharge(input: { bookingId: string; type: BookingChargeType; amountCents: number; note?: string; recordedByUserId: string }, tx: Db = db) {
      const [row] = await tx.insert(bookingCharges).values({
        ...input,
        note: input.note?.trim() || null,
      }).returning();
      return row;
    },

    async findCharge(bookingId: string, type: BookingChargeType, tx: Db = db) {
      const [row] = await tx.select().from(bookingCharges)
        .where(and(eq(bookingCharges.bookingId, bookingId), eq(bookingCharges.type, type))).limit(1);
      return row ?? null;
    },
  };
}

export type PartyWorkflowRepository = ReturnType<typeof createPartyWorkflowRepository>;
