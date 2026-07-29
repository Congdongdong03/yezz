import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  submitLiveOrdinaryForm,
  transitionFromAdmin,
} from "./fixtures/closure-ui";
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
  extractManagementToken,
  readMailpitMessage,
  waitForMailpitMessage,
} from "./fixtures/mailpit";

// These are complete customer/admin/email workflows, exercised in both
// desktop and iPhone projects. The browser portion is intentionally real,
// rather than a direct API shortcut, so it needs a budget beyond the default.
test.setTimeout(90_000);

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
      policyVersion: "2026-07-30",
      policyAccepted: true,
    };

    const bookingId = await submitLiveOrdinaryForm({
      page,
      fixture,
      locale: "en",
      email: customerEmail,
      mode: "booking",
    });
    fixture.requestIds.add(bookingId);

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
        activeIntervalAttendance: number;
      }[]>`
        select
          b.status,
          b.duration_minutes as "durationMinutes",
          b.attendance_count as "attendanceCount",
          (select count(*)::int from booking_items i where i.booking_id = b.id) as "itemCount",
          (select count(*)::int from request_status_events e where e.booking_id = b.id) as "eventCount"
          ,(select coalesce(sum(active.attendance_count), 0)::int
            from bookings active
            where active.slot_date = b.slot_date
              and active.slot_start_time < b.slot_end_time
              and active.slot_end_time > b.slot_start_time
              and active.status in ('confirmed', 'confirmed_paid', 'completed')) as "activeIntervalAttendance"
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
      activeIntervalAttendance: 0,
    });

    await page.goto(`/admin/bookings/${bookingId}`);
    await expect(
      page.getByRole("heading", { name: "体验预约详情" }),
    ).toBeVisible();
    await expect(page.getByText("待审核").first()).toBeVisible();

    const confirmed = await transitionFromAdmin({
      page,
      kind: "bookings",
      requestId: bookingId,
      actionName: "确认预约",
    });
    expect(confirmed.status).toBe("confirmed");
    const confirmedReplay = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      {
        action: "transition",
        expectedStatus: "pending_review",
        toStatus: "confirmed",
        operationId: confirmed.operationId,
        newDate: fixture.bookingDate,
        newStartTime: "10:00",
      },
    );
    expect(confirmedReplay.status()).toBe(200);
    expect((await confirmedReplay.json()).data.replayed).toBe(true);
    const confirmationMessage = await waitForMailpitMessage({
      recipient: customerEmail,
      subjectIncludes: "Booking Confirmed",
    });
    const managementToken = extractManagementToken(
      await readMailpitMessage(confirmationMessage),
    );
    await page.goto(`/en/manage-booking/${managementToken}`);
    await expect(
      page.getByRole("heading", { name: "Manage your YezYY request" }),
    ).toBeVisible();

    await fixture.makeReminderEligible(bookingId);
    await waitForMailpitMessage({
      recipient: customerEmail,
      subjectIncludes: "Booking Reminder",
      timeoutMilliseconds: 15_000,
    });

    const completed = await transitionFromAdmin({
      page,
      kind: "bookings",
      requestId: bookingId,
      actionName: "标记已完成",
      note: "闭环完成",
    });
    expect(completed.status).toBe("completed");

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

    await fixture.sql`
      update studio_weekly_hours
      set is_closed = true
      where weekday = extract(dow from ${fixture.bookingDate}::date)::int
    `;
    const stale = await post(page, "/api/backend/v1/bookings", {
      ...request,
      name: `Stale ${fixture.runId}`,
      email: `stale-${fixture.runId}@example.test`,
    }, crypto.randomUUID());
    expect(stale.status()).toBe(400);
    expect((await stale.json()).error.code).toBe("STUDIO_CLOSED");
    const [noPartialWrite] = await fixture.sql<{ count: number }[]>`
      select count(*)::int as count from bookings
      where email = ${`stale-${fixture.runId}@example.test`}
    `;
    expect(noPartialWrite?.count).toBe(0);
  } finally {
    await deleteMailpitMessagesFor([customerEmail]);
    await fixture?.cleanup();
  }
});
