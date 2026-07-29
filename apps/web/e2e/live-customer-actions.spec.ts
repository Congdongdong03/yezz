import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  APPROVED_WEEKLY_HOURS,
  seedLiveBookingFixture,
  type LiveBookingFixture,
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

function post(page: Page, path: string, body: unknown, idempotencyKey?: string) {
  return page.request.post(path, {
    data: body,
    headers: {
      origin: process.env.NEXT_PUBLIC_SITE_URL!,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
  });
}

async function createConfirmedOrdinary(input: {
  page: Page;
  fixture: LiveBookingFixture;
  email: string;
  project: { id: string };
  startTime: string;
}) {
  const response = await post(
    input.page,
    "/api/backend/v1/bookings",
    {
      kind: "experience",
      mode: "booking",
      name: `Customer action ${input.fixture.runId}`,
      phone: "0430787740",
      email: input.email,
      date: input.fixture.bookingDate,
      startTime: input.startTime,
      participantCount: 1,
      youngChildCount: 0,
      accompanyingAdultCount: 0,
      items: [{ projectId: input.project.id, quantity: 1 }],
      locale: "en",
      policyVersion: "2026-07-29",
      policyAccepted: true,
    },
    crypto.randomUUID(),
  );
  expect(response.status()).toBe(201);
  const bookingId = (await response.json()).data.id as string;
  input.fixture.requestIds.add(bookingId);
  const confirm = await post(
    input.page,
    `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
    {
      action: "transition",
      expectedStatus: "pending_review",
      toStatus: "confirmed",
      operationId: crypto.randomUUID(),
      newDate: input.fixture.bookingDate,
      newStartTime: input.startTime,
    },
  );
  expect(confirm.status()).toBe(200);
  const message = await waitForMailpitMessage({
    recipient: input.email,
    subjectIncludes: "Booking Confirmed",
  });
  return {
    bookingId,
    token: extractManagementToken(await readMailpitMessage(message)),
  };
}

test("management links are isolated, private, generic when invalid, and one-use for customer changes", async ({
  page,
}) => {
  let fixture: LiveBookingFixture | undefined;
  const cancellationEmail = `cancel-${crypto.randomUUID()}@example.test`;
  const rescheduleEmail = `reschedule-${crypto.randomUUID()}@example.test`;
  try {
    fixture = await seedLiveBookingFixture({
      weeklyHours: APPROVED_WEEKLY_HOURS,
      projects: LIVE_DIY_PROJECTS,
      parties: LIVE_PARTY_PACKAGES,
      capabilities: { experience: true, party: true, product: false },
    });
    const cancellation = await createConfirmedOrdinary({
      page,
      fixture,
      email: cancellationEmail,
      project: fixture.projects.short,
      startTime: "10:00",
    });
    const reschedule = await createConfirmedOrdinary({
      page,
      fixture,
      email: rescheduleEmail,
      project: fixture.projects.long,
      startTime: "14:00",
    });

    const activeRead = await page.request.get(
      `/api/backend/v1/customer-bookings/${cancellation.token}`,
    );
    const activeText = await activeRead.text();
    expect(
      activeRead.status(),
      `active management response: ${activeText}`,
    ).toBe(200);
    expect(JSON.parse(activeText).data).toMatchObject({
      kind: "experience",
      date: fixture.bookingDate,
      startTime: "10:00",
      endTime: "10:30",
    });
    const otherRead = await page.request.get(
      `/api/backend/v1/customer-bookings/${reschedule.token}`,
    );
    expect((await otherRead.json()).data).toMatchObject({
      kind: "experience",
      date: fixture.bookingDate,
      startTime: "14:00",
      endTime: "15:00",
    });
    await page.goto(`/en/manage-booking/${cancellation.token}`);
    await expect(page.getByRole("heading", { name: "DIY booking" })).toBeVisible();
    await expect(page.getByText("10:00–10:30", { exact: false })).toBeVisible();
    await expect(page.getByText("14:00–15:00", { exact: false })).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex.*nofollow|nofollow.*noindex/i,
    );
    await expect(
      page.locator('script[src*="googletagmanager.com"]'),
    ).toHaveCount(0);

    const expiredRaw = crypto.randomBytes(32).toString("base64url");
    const revokedRaw = crypto.randomBytes(32).toString("base64url");
    await fixture.sql`
      insert into customer_action_tokens (
        booking_id, token_digest, scopes, expires_at
      )
      values (
        ${cancellation.bookingId},
        ${crypto.createHash("sha256").update(expiredRaw).digest("hex")},
        ${["request_cancellation"]},
        now() - interval '1 minute'
      )
    `;
    await fixture.sql`
      insert into customer_action_tokens (
        booking_id, token_digest, scopes, expires_at, revoked_at
      )
      values (
        ${reschedule.bookingId},
        ${crypto.createHash("sha256").update(revokedRaw).digest("hex")},
        ${["request_reschedule"]},
        now() + interval '1 day',
        now()
      )
    `;
    for (const invalidToken of [expiredRaw, revokedRaw]) {
      await page.goto(`/en/manage-booking/${invalidToken}`);
      await expect(
        page.getByRole("heading", {
          name: "This booking link is not available",
        }),
      ).toBeVisible();
      await expect(page.getByText("10:00–10:30", { exact: false })).toHaveCount(0);
      await expect(page.getByText("14:00–15:00", { exact: false })).toHaveCount(0);
    }

    const cancellationFirst = await post(
      page,
      `/api/backend/v1/customer-bookings/${cancellation.token}/request-cancellation`,
      {},
    );
    const cancellationReplay = await post(
      page,
      `/api/backend/v1/customer-bookings/${cancellation.token}/request-cancellation`,
      {},
    );
    expect(cancellationFirst.status()).toBe(200);
    expect(cancellationReplay.status()).toBe(403);

    const rescheduleFirst = await post(
      page,
      `/api/backend/v1/customer-bookings/${reschedule.token}/request-reschedule`,
      { date: fixture.bookingDate, startTime: "15:30" },
    );
    const rescheduleReplay = await post(
      page,
      `/api/backend/v1/customer-bookings/${reschedule.token}/request-reschedule`,
      { date: fixture.bookingDate, startTime: "15:30" },
    );
    expect(rescheduleFirst.status()).toBe(200);
    expect(rescheduleReplay.status()).toBe(403);

    const states = await fixture.sql<{
      id: string;
      status: string;
      eventCount: number;
      customerEmailCount: number;
    }[]>`
      select
        b.id,
        b.status,
        (select count(*)::int from request_status_events e
          where e.booking_id = b.id and e.actor_kind = 'customer') as "eventCount",
        (select count(*)::int from email_outbox o
          where o.booking_id = b.id
            and o.message_type = 'booking_notification_customer'
            and o.payload->>'template' in ('cancellation_request', 'reschedule_request')) as "customerEmailCount"
      from bookings b
      where b.id in (${cancellation.bookingId}, ${reschedule.bookingId})
      order by b.id
    `;
    expect(
      states.map(({ status, eventCount, customerEmailCount }) => ({
        status,
        eventCount,
        customerEmailCount,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          status: "cancellation_requested",
          eventCount: 1,
          customerEmailCount: 1,
        },
        {
          status: "reschedule_requested",
          eventCount: 1,
          customerEmailCount: 1,
        },
      ]),
    );
  } finally {
    await deleteMailpitMessagesFor([cancellationEmail, rescheduleEmail]);
    await fixture?.cleanup();
  }
});

test("database and environment gates keep all public request writes closed", async ({
  page,
}) => {
  let fixture: LiveBookingFixture | undefined;
  try {
    fixture = await seedLiveBookingFixture({
      weeklyHours: APPROVED_WEEKLY_HOURS,
      projects: LIVE_DIY_PROJECTS,
      parties: LIVE_PARTY_PACKAGES,
      capabilities: { experience: false, party: false, product: false },
    });
    await page.goto("/en/book");
    await expect(
      page.getByTestId("request-contact-fallback"),
    ).toBeVisible();
    await page.goto("/zh/parties");
    await expect(
      page.getByTestId("request-contact-fallback"),
    ).toBeVisible();

    const before = await fixture.sql<{
      bookings: number;
      orders: number;
      consumptions: number;
    }[]>`
      select
        (select count(*)::int from bookings) as bookings,
        (select count(*)::int from cart_orders) as orders,
        (select coalesce(sum(request_count), 0)::int
          from request_rate_limits) as consumptions
    `;
    const ordinary = await post(
      page,
      "/api/backend/v1/bookings",
      {
        kind: "experience",
        mode: "booking",
        name: "Closed",
        phone: "0430787750",
        email: "closed@example.test",
        date: fixture.bookingDate,
        startTime: "10:00",
        participantCount: 1,
        youngChildCount: 0,
        accompanyingAdultCount: 0,
        items: [{ projectId: fixture.projects.short.id, quantity: 1 }],
        locale: "en",
        policyVersion: "2026-07-29",
        policyAccepted: true,
      },
      crypto.randomUUID(),
    );
    const party = await post(
      page,
      "/api/backend/v1/bookings",
      {
        kind: "party",
        partyPackageId: fixture.parties.short.id,
        name: "Closed party",
        phone: "0430787751",
        email: "closed-party@example.test",
        birthdayChildName: "Closed",
        birthdayChildAge: 7,
        participantCount: 6,
        parentCount: 2,
        desiredDate: fixture.bookingDate,
        desiredStartTime: "12:00",
        projectInterests: ["Closed"],
        byoCake: false,
        byoDrinks: false,
        byoFood: false,
        byoSnacks: false,
        cakeCuttingRequested: false,
        locale: "en",
        policyVersion: "2026-07-29",
        policyAccepted: true,
      },
      crypto.randomUUID(),
    );
    const afterDatabaseGates = await fixture.sql<{
      bookings: number;
      orders: number;
      consumptions: number;
    }[]>`
      select
        (select count(*)::int from bookings) as bookings,
        (select count(*)::int from cart_orders) as orders,
        (select coalesce(sum(request_count), 0)::int
          from request_rate_limits) as consumptions
    `;
    expect(afterDatabaseGates[0]).toEqual({
      bookings: before[0]!.bookings,
      orders: before[0]!.orders,
      consumptions: before[0]!.consumptions + 2,
    });

    const product = await post(
      page,
      "/api/backend/v1/cart-orders",
      { customer: {}, items: [] },
      crypto.randomUUID(),
    );
    for (const response of [ordinary, party, product]) {
      expect(response.status()).toBe(503);
      expect((await response.json()).error.code).toBe(
        "REQUEST_FLOW_DISABLED",
      );
    }
    const afterProductGate = await fixture.sql<{
      bookings: number;
      orders: number;
      consumptions: number;
    }[]>`
      select
        (select count(*)::int from bookings) as bookings,
        (select count(*)::int from cart_orders) as orders,
        (select coalesce(sum(request_count), 0)::int
          from request_rate_limits) as consumptions
    `;
    expect(afterProductGate).toEqual(afterDatabaseGates);
  } finally {
    await fixture?.cleanup();
  }
});
