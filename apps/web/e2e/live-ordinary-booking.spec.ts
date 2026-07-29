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

async function post(
  page: Page,
  path: string,
  body: unknown,
  idempotencyKey?: string,
) {
  return page.request.post(path, {
    data: body,
    headers: {
      origin: process.env.NEXT_PUBLIC_SITE_URL!,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
  });
}

test("English ordinary request closes through Chinese admin, secure email, reminder, and completion", async ({
  page,
}) => {
  let fixture: LiveBookingFixture | undefined;
  const customerEmail = `ordinary-${crypto.randomUUID()}@example.test`;
  try {
    fixture = await seedLiveBookingFixture({
      weeklyHours: APPROVED_WEEKLY_HOURS,
      projects: LIVE_DIY_PROJECTS,
      parties: LIVE_PARTY_PACKAGES,
      capabilities: { experience: true, party: true, product: false },
    });
    const idempotencyKey = crypto.randomUUID();
    const request = {
      kind: "experience",
      mode: "booking",
      name: `Ordinary ${fixture.runId}`,
      phone: "0430787712",
      email: customerEmail,
      date: fixture.bookingDate,
      startTime: "10:00",
      participantCount: 2,
      youngChildCount: 1,
      accompanyingAdultCount: 1,
      items: [
        { projectId: fixture.projects.short.id, quantity: 1 },
        { projectId: fixture.projects.long.id, quantity: 1 },
      ],
      locale: "en",
      policyVersion: "2026-07-29",
      policyAccepted: true,
    };

    const first = await post(
      page,
      "/api/backend/v1/bookings",
      request,
      idempotencyKey,
    );
    const replay = await post(
      page,
      "/api/backend/v1/bookings",
      request,
      idempotencyKey,
    );
    expect(first.status()).toBe(201);
    expect(replay.status()).toBe(201);
    const firstBody = await first.json();
    const replayBody = await replay.json();
    const bookingId = firstBody.data.id as string;
    fixture.requestIds.add(bookingId);
    expect(replayBody.data).toMatchObject({
      id: bookingId,
      replayed: true,
    });

    await waitForMailpitMessage({
      recipient: customerEmail,
      subjectIncludes: "Booking Request Received",
    });
    const pending = await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{
        status: string;
        durationMinutes: number;
        attendanceCount: number;
        itemCount: number;
        eventCount: number;
      }[]>`
        select
          b.status,
          b.duration_minutes as "durationMinutes",
          b.attendance_count as "attendanceCount",
          (select count(*)::int from booking_items i where i.booking_id = b.id) as "itemCount",
          (select count(*)::int from request_status_events e where e.booking_id = b.id) as "eventCount"
        from bookings b
        where b.id = ${bookingId}
      `;
      return row ?? null;
    }, "ordinary request");
    expect(pending).toEqual({
      status: "pending_review",
      durationMinutes: 60,
      attendanceCount: 3,
      itemCount: 2,
      eventCount: 0,
    });

    await page.goto(`/admin/bookings/${bookingId}`);
    await expect(
      page.getByRole("heading", { name: "体验预约详情" }),
    ).toBeVisible();
    await expect(page.getByText("待审核").first()).toBeVisible();

    const confirmOperation = crypto.randomUUID();
    const confirmBody = {
      action: "transition",
      expectedStatus: "pending_review",
      toStatus: "confirmed",
      operationId: confirmOperation,
      newDate: fixture.bookingDate,
      newStartTime: "10:00",
    };
    const confirmed = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      confirmBody,
    );
    const confirmedReplay = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      confirmBody,
    );
    expect(confirmed.status()).toBe(200);
    expect(confirmedReplay.status()).toBe(200);
    expect((await confirmedReplay.json()).data.replayed).toBe(true);
    await waitForMailpitMessage({
      recipient: customerEmail,
      subjectIncludes: "Booking Confirmed",
    });

    await fixture.makeReminderEligible(bookingId);
    await waitForMailpitMessage({
      recipient: customerEmail,
      subjectIncludes: "Booking Reminder",
      timeoutMilliseconds: 15_000,
    });

    const completionOperation = crypto.randomUUID();
    const completed = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      {
        action: "transition",
        expectedStatus: "confirmed",
        toStatus: "completed",
        operationId: completionOperation,
        note: "闭环完成",
      },
    );
    expect(completed.status()).toBe(200);

    const finalState = await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{
        status: string;
        confirmedEvents: number;
        completedEvents: number;
        confirmationEmails: number;
        reminderEmails: number;
      }[]>`
        select
          b.status,
          (select count(*)::int from request_status_events e where e.booking_id = b.id and e.to_status = 'confirmed') as "confirmedEvents",
          (select count(*)::int from request_status_events e where e.booking_id = b.id and e.to_status = 'completed') as "completedEvents",
          (select count(*)::int from email_outbox o where o.booking_id = b.id and o.payload->>'template' = 'booking_confirmed') as "confirmationEmails",
          (select count(*)::int from email_outbox o where o.booking_id = b.id and o.payload->>'template' = 'booking_reminder') as "reminderEmails"
        from bookings b
        where b.id = ${bookingId}
      `;
      return row?.status === "completed" ? row : null;
    }, "completed ordinary workflow");
    expect(finalState).toEqual({
      status: "completed",
      confirmedEvents: 1,
      completedEvents: 1,
      confirmationEmails: 1,
      reminderEmails: 1,
    });
  } finally {
    await deleteMailpitMessagesFor([customerEmail]);
    await fixture?.cleanup();
  }
});
