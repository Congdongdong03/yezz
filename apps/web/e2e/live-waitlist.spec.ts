import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  APPROVED_WEEKLY_HOURS,
  seedLiveBookingFixture,
  type LiveBookingFixture,
  waitForDatabaseRow,
} from "./fixtures/closure-database";
import {
  LIVE_DIY_PROJECTS,
  LIVE_PARTY_PACKAGES,
} from "../../../packages/db/src/live-booking-catalogue";
import {
  deleteMailpitMessagesFor,
  waitForMailpitMessage,
} from "./fixtures/mailpit";

function post(page: Page, path: string, body: unknown, idempotencyKey?: string) {
  return page.request.post(path, {
    data: body,
    headers: {
      origin: process.env.NEXT_PUBLIC_SITE_URL!,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
  });
}

test("waitlist reserves no capacity and converts once only after customer contact", async ({
  page,
}) => {
  let fixture: LiveBookingFixture | undefined;
  const email = `waitlist-${crypto.randomUUID()}@example.test`;
  try {
    fixture = await seedLiveBookingFixture({
      weeklyHours: APPROVED_WEEKLY_HOURS,
      projects: LIVE_DIY_PROJECTS,
      parties: LIVE_PARTY_PACKAGES,
      capabilities: { experience: true, party: true, product: false },
    });
    const blockerId = crypto.randomUUID();
    fixture.requestIds.add(blockerId);
    await fixture.sql`
      insert into bookings (
        id, name, phone, email, request_kind, status, slot_date,
        slot_start_time, slot_end_time, participant_count, young_child_count,
        accompanying_adult_count, attendance_count, duration_minutes,
        policy_version, policy_accepted_at
      )
      values (
        ${blockerId}, 'Closure capacity blocker', '0430000010',
        'blocker@example.test', 'experience', 'confirmed',
        ${fixture.bookingDate}, '10:00', '11:00', 6, 0, 0, 6, 60,
        '2026-07-29', now()
      )
    `;

    const response = await post(
      page,
      "/api/backend/v1/bookings",
      {
        kind: "experience",
        mode: "waitlist",
        name: `Waitlist ${fixture.runId}`,
        phone: "0430787720",
        email,
        date: fixture.bookingDate,
        startTime: "10:00",
        participantCount: 2,
        youngChildCount: 0,
        accompanyingAdultCount: 1,
        items: [{ projectId: fixture.projects.long.id, quantity: 2 }],
        locale: "en",
        policyVersion: "2026-07-29",
        policyAccepted: true,
      },
      crypto.randomUUID(),
    );
    expect(response.status()).toBe(201);
    const bookingId = (await response.json()).data.id as string;
    fixture.requestIds.add(bookingId);
    await waitForMailpitMessage({
      recipient: email,
      subjectIncludes: "Booking Waitlist",
    });

    const before = await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{
        status: string;
        initialEvents: number;
        waitlistEmails: number;
      }[]>`
        select
          b.status,
          (select count(*)::int from request_status_events e
            where e.booking_id = b.id and e.to_status = 'waitlisted') as "initialEvents",
          (select count(*)::int from email_outbox o
            where o.booking_id = b.id and o.payload->>'template' = 'booking_waitlisted') as "waitlistEmails"
        from bookings b where b.id = ${bookingId}
      `;
      return row ?? null;
    }, "waitlisted request");
    expect(before).toEqual({
      status: "waitlisted",
      initialEvents: 1,
      waitlistEmails: 1,
    });

    await fixture.sql`
      update bookings set status = 'completed', updated_at = now()
      where id = ${blockerId}
    `;
    const operationId = crypto.randomUUID();
    const withoutContact = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      {
        action: "transition",
        expectedStatus: "waitlisted",
        toStatus: "confirmed",
        operationId,
        newDate: fixture.bookingDate,
        newStartTime: "10:00",
        contactedCustomer: false,
      },
    );
    expect(withoutContact.status()).toBe(400);
    expect((await withoutContact.json()).error.code).toBe(
      "WAITLIST_CONTACT_REQUIRED",
    );

    const withContact = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      {
        action: "transition",
        expectedStatus: "waitlisted",
        toStatus: "confirmed",
        operationId,
        newDate: fixture.bookingDate,
        newStartTime: "10:00",
        contactedCustomer: true,
      },
    );
    const replay = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      {
        action: "transition",
        expectedStatus: "waitlisted",
        toStatus: "confirmed",
        operationId,
        newDate: fixture.bookingDate,
        newStartTime: "10:00",
        contactedCustomer: true,
      },
    );
    expect(withContact.status()).toBe(200);
    expect(replay.status()).toBe(200);
    expect((await replay.json()).data.replayed).toBe(true);
    await waitForMailpitMessage({
      recipient: email,
      subjectIncludes: "Booking Confirmed",
    });

    const [finalState] = await fixture.sql<{
      status: string;
      confirmationEvents: number;
      confirmationEmails: number;
    }[]>`
      select
        b.status,
        (select count(*)::int from request_status_events e
          where e.booking_id = b.id and e.to_status = 'confirmed') as "confirmationEvents",
        (select count(*)::int from email_outbox o
          where o.booking_id = b.id and o.payload->>'template' = 'booking_confirmed') as "confirmationEmails"
      from bookings b where b.id = ${bookingId}
    `;
    expect(finalState).toEqual({
      status: "confirmed",
      confirmationEvents: 1,
      confirmationEmails: 1,
    });
  } finally {
    await deleteMailpitMessagesFor([email]);
    await fixture?.cleanup();
  }
});
