import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RequestFlowTestDatabase } from "../test-utils/request-flow-postgres.js";
import { createRequestFlowTestDatabase } from "../test-utils/request-flow-postgres.js";
import { createBookingMaintenanceRepository } from "./booking-maintenance.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("booking maintenance repository", () => {
  let database: RequestFlowTestDatabase;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
  });

  afterEach(async () => {
    await database.close();
  });

  async function insertBooking(input: {
    requestKind?: "experience" | "party";
    status?: string;
    email?: string | null;
    locale?: "en" | "zh";
    date?: string | null;
    start?: string | null;
    end?: string | null;
    deadline?: Date;
    venueFeeCents?: number;
  }): Promise<string> {
    const [booking] = await database.connection.client`
      INSERT INTO bookings (
        name, phone, email, locale, request_kind, status,
        offering_name_snapshot, slot_date, slot_start_time, slot_end_time
      )
      VALUES (
        'Maintenance Customer', '0430787712', ${input.email === undefined ? "customer@example.com" : input.email},
        ${input.locale ?? "en"}, ${input.requestKind ?? "experience"},
        ${input.status ?? "confirmed"}, ${JSON.stringify({ en: "DIY", zh: "手工" })}::jsonb,
        ${input.date === undefined ? "2026-10-04" : input.date},
        ${input.start === undefined ? "12:00" : input.start},
        ${input.end === undefined ? "13:00" : input.end}
      )
      RETURNING id
    `;
    if (input.requestKind === "party") {
      const paymentDeadline = (
        input.deadline ?? new Date("2026-10-03T00:00:00.000Z")
      ).toISOString();
      await database.connection.client`
        INSERT INTO booking_party_details (
          booking_id, birthday_child_name, birthday_child_age,
          participant_count, parent_count, desired_date, desired_start_time,
          final_date, final_setup_start, final_guest_start, final_guest_end,
          final_cleanup_end, venue_fee_cents, min_spend_per_person_cents,
          payment_deadline
        )
        VALUES (
          ${booking.id}, 'Child', 8, 6, 1, '2026-10-04', '12:00',
          ${input.date === undefined ? "2026-10-04" : input.date},
          '11:30', ${input.start === undefined ? "12:00" : input.start},
          ${input.end === undefined ? "13:00" : input.end}, '13:30',
          ${input.venueFeeCents ?? 9500}, 4500,
          ${paymentDeadline}::timestamptz
        )
      `;
    }
    return booking.id as string;
  }

  it("selects the inclusive 23h55m–24h05m Melbourne appointment window across DST", async () => {
    const repo = createBookingMaintenanceRepository(database.connection.db);
    const now = new Date("2026-10-03T01:00:00.000Z");
    const atStart = await insertBooking({ start: "11:55", end: "12:55" });
    const exact = await insertBooking({ start: "12:00", end: "13:00" });
    const atEnd = await insertBooking({ start: "12:05", end: "13:05" });
    await insertBooking({ start: "11:54", end: "12:54" });
    await insertBooking({ start: "12:06", end: "13:06" });
    const party = await insertBooking({
      requestKind: "party",
      status: "confirmed_paid",
      start: "12:00",
      end: "14:30",
    });

    const candidates = await repo.findBookingsNeedingReminder(now);

    expect(candidates.map(({ bookingId }) => bookingId).sort()).toEqual(
      [atStart, exact, atEnd, party].sort(),
    );
    expect(
      candidates.find(({ bookingId }) => bookingId === party),
    ).toMatchObject({
      startTime: "12:00",
      endTime: "14:30",
      amountCents: 9500,
    });
  });

  it("excludes ineligible state, missing slot/email, non-final party, and an existing reminder", async () => {
    const repo = createBookingMaintenanceRepository(database.connection.db);
    const now = new Date("2026-10-03T01:00:00.000Z");
    const eligible = await insertBooking({});
    await insertBooking({ status: "pending_review" });
    await insertBooking({ status: "cancelled" });
    await insertBooking({ email: null });
    await insertBooking({ date: null, start: null, end: null });
    await insertBooking({ requestKind: "party", status: "confirmed" });

    await repo.markReminderEnqueued(
      {
        bookingId: eligible,
        customerName: "Maintenance Customer",
        email: "customer@example.com",
        locale: "en",
        createdAt: new Date("2026-07-29T00:00:00.000Z"),
        offeringLabel: "DIY",
        date: "2026-10-04",
        startTime: "12:00",
        endTime: "13:00",
        manageUrl:
          "https://yezyy.com/en/manage-booking/abcdefghijklmnopqrstuvwxyzABCDEFG123456789",
        rawToken: "abcdefghijklmnopqrstuvwxyzABCDEFG123456789",
        tokenDigest:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      now,
    );

    await expect(repo.findBookingsNeedingReminder(now)).resolves.toEqual([]);
  });

  it("selects only overdue active party holds", async () => {
    const repo = createBookingMaintenanceRepository(database.connection.db);
    const now = new Date("2026-10-03T01:00:00.000Z");
    const overdue = await insertBooking({
      requestKind: "party",
      status: "awaiting_in_store_payment",
      deadline: new Date("2026-10-03T01:00:00.000Z"),
    });
    await insertBooking({
      requestKind: "party",
      status: "awaiting_in_store_payment",
      deadline: new Date("2026-10-03T01:00:01.000Z"),
    });
    for (const status of ["confirmed_paid", "payment_expired", "cancelled"]) {
      await insertBooking({
        requestKind: "party",
        status,
        deadline: new Date("2026-10-03T00:00:00.000Z"),
      });
    }
    await insertBooking({
      requestKind: "experience",
      status: "confirmed",
    });

    await expect(repo.findExpiredPartyHolds(now)).resolves.toEqual([
      expect.objectContaining({ bookingId: overdue }),
    ]);
  });

  it("creates one token and one reminder outbox row under concurrent enqueue", async () => {
    const repo = createBookingMaintenanceRepository(database.connection.db);
    const now = new Date("2026-10-03T01:00:00.000Z");
    const bookingId = await insertBooking({});
    const input = {
      bookingId,
      customerName: "Maintenance Customer",
      email: "customer@example.com",
      locale: "en" as const,
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      offeringLabel: "DIY",
      date: "2026-10-04",
      startTime: "12:00",
      endTime: "13:00",
      manageUrl:
        "https://yezyy.com/en/manage-booking/abcdefghijklmnopqrstuvwxyzABCDEFG123456789",
      rawToken: "abcdefghijklmnopqrstuvwxyzABCDEFG123456789",
      tokenDigest:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    };

    await Promise.all([
      repo.markReminderEnqueued(input, now),
      repo.markReminderEnqueued(input, now),
    ]);

    const [outboxCount] = await database.connection.client`
      SELECT count(*)::int AS count
      FROM email_outbox
      WHERE dedupe_key = ${`booking:${bookingId}:reminder:2026-10-04:customer`}
    `;
    const [tokenCount] = await database.connection.client`
      SELECT count(*)::int AS count
      FROM customer_action_tokens
      WHERE booking_id = ${bookingId}
        AND token_digest = ${input.tokenDigest}
    `;
    expect(outboxCount.count).toBe(1);
    expect(tokenCount.count).toBe(1);
  });
});
