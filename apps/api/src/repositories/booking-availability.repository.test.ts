import { createDb } from "@yezz/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBookingAvailabilityRepository } from "./booking-availability.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_AVAILABILITY_TESTS === "1";
const configuredTestUrl = process.env.TEST_DATABASE_URL;

function requireSafeTestDatabaseUrl(): string {
  if (!configuredTestUrl) throw new Error("TEST_DATABASE_URL is required");
  if (configuredTestUrl === process.env.DATABASE_URL) {
    throw new Error("Availability tests refuse TEST_DATABASE_URL equal to DATABASE_URL");
  }
  if (!/(?:test|local|dev)/i.test(new URL(configuredTestUrl).pathname)) {
    throw new Error("Availability tests require an isolated test database");
  }
  return configuredTestUrl;
}

function withSearchPath(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-csearch_path=${schema}`);
  return parsed.toString();
}

describe.skipIf(!runDatabaseTests)("booking availability repository", () => {
  let schema = "";
  let bootstrap: ReturnType<typeof createDb> | undefined;
  let connection: ReturnType<typeof createDb> | undefined;

  beforeEach(async () => {
    const url = requireSafeTestDatabaseUrl();
    schema = `yezyy_availability_test_${crypto.randomUUID().replaceAll("-", "")}`;
    bootstrap = createDb(url);
    await bootstrap.client.unsafe(`CREATE SCHEMA "${schema}"`);
    await bootstrap.client.unsafe(`
      CREATE TABLE "${schema}".bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL DEFAULT 'Test',
        phone varchar(64) NOT NULL DEFAULT '000',
        request_kind varchar(32) NOT NULL,
        status varchar(32) NOT NULL,
        slot_date date,
        slot_start_time varchar(8),
        slot_end_time varchar(8),
        attendance_count integer
      );
      CREATE TABLE "${schema}".studio_weekly_hours (
        weekday integer PRIMARY KEY, opens_at varchar(5) NOT NULL,
        closes_at varchar(5) NOT NULL, is_closed boolean NOT NULL DEFAULT false
      );
      CREATE TABLE "${schema}".studio_special_hours (
        date date PRIMARY KEY, opens_at varchar(5), closes_at varchar(5),
        is_closed boolean NOT NULL DEFAULT false, note text
      );
      CREATE TABLE "${schema}".studio_closures (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date date NOT NULL,
        start_time varchar(5), end_time varchar(5), note text
      )
    `);
    connection = createDb(withSearchPath(url, schema));
  });

  afterEach(async () => {
    await connection?.client.end();
    if (bootstrap) {
      await bootstrap.client.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await bootstrap.client.end();
    }
  });

  async function insertBooking(values: {
    requestKind: "experience" | "party";
    status: string;
    start: string;
    end: string;
    attendance?: number | null;
  }): Promise<string> {
    const [row] = await connection!.client.unsafe<{ id: string }[]>(
      `INSERT INTO bookings (request_kind, status, slot_date, slot_start_time, slot_end_time, attendance_count)
       VALUES ($1, $2, '2026-08-01', $3, $4, $5) RETURNING id`,
      [
        values.requestKind,
        values.status,
        values.start,
        values.end,
        values.attendance ?? null,
      ],
    );
    return row!.id;
  }

  it("counts only overlapping confirmed ordinary attendance", async () => {
    await insertBooking({ requestKind: "experience", status: "confirmed", start: "10:00", end: "11:00", attendance: 3 });
    await insertBooking({ requestKind: "experience", status: "pending_review", start: "10:00", end: "11:00", attendance: 6 });
    await insertBooking({ requestKind: "party", status: "confirmed", start: "10:00", end: "11:00", attendance: 8 });
    await insertBooking({ requestKind: "experience", status: "confirmed", start: "11:00", end: "12:00", attendance: 7 });

    const result = await createBookingAvailabilityRepository(connection!.db)
      .sumConfirmedAttendance({ date: "2026-08-01", startTime: "10:00", endTime: "11:00" });

    expect(result).toBe(3);
  });

  it("excludes the booking being restored while keeping other pending requests occupied", async () => {
    const self = await insertBooking({ requestKind: "experience", status: "cancellation_requested", start: "10:00", end: "11:00", attendance: 5 });
    await insertBooking({ requestKind: "experience", status: "reschedule_requested", start: "10:00", end: "11:00", attendance: 2 });
    const repo = createBookingAvailabilityRepository(connection!.db);
    await expect(repo.sumConfirmedAttendance({ date: "2026-08-01", startTime: "10:00", endTime: "11:00" }, undefined, { excludeBookingId: self })).resolves.toBe(2);
  });

  it("treats active party intervals as exclusive with half-open boundaries", async () => {
    await insertBooking({ requestKind: "party", status: "awaiting_in_store_payment", start: "11:00", end: "12:00" });
    await insertBooking({ requestKind: "party", status: "confirmed_paid", start: "13:00", end: "14:00" });
    await insertBooking({ requestKind: "party", status: "confirmed", start: "15:00", end: "16:00" });

    const repo = createBookingAvailabilityRepository(connection!.db);
    await expect(repo.hasExclusivePartyOverlap({ date: "2026-08-01", startTime: "10:00", endTime: "11:00" })).resolves.toBe(false);
    await expect(repo.hasExclusivePartyOverlap({ date: "2026-08-01", startTime: "11:30", endTime: "12:30" })).resolves.toBe(true);
    await expect(repo.hasExclusivePartyOverlap({ date: "2026-08-01", startTime: "13:30", endTime: "14:30" })).resolves.toBe(true);
    await expect(repo.hasExclusivePartyOverlap({ date: "2026-08-01", startTime: "15:30", endTime: "16:30" })).resolves.toBe(true);
  });
});
