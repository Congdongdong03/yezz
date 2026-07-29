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

async function createParty(
  page: Page,
  fixture: LiveBookingFixture,
  email: string,
  desiredStartTime = "12:00",
) {
  const response = await post(
    page,
    "/api/backend/v1/bookings",
    {
      kind: "party",
      partyPackageId: fixture.parties.short.id,
      name: `派对闭环 ${fixture.runId}`,
      phone: "0430787730",
      email,
      birthdayChildName: "小乐",
      birthdayChildAge: 7,
      participantCount: 6,
      parentCount: 2,
      desiredDate: fixture.bookingDate,
      desiredStartTime,
      projectInterests: ["Decoden"],
      byoCake: true,
      byoDrinks: false,
      byoFood: false,
      byoSnacks: true,
      cakeCuttingRequested: false,
      locale: "zh",
      policyVersion: "2026-07-29",
      policyAccepted: true,
    },
    crypto.randomUUID(),
  );
  expect(response.status()).toBe(201);
  const id = (await response.json()).data.id as string;
  fixture.requestIds.add(id);
  return id;
}

function proposal(
  fixture: LiveBookingFixture,
  finalGuestStart: string,
  operationId = crypto.randomUUID(),
) {
  return {
    action: "propose_party_time",
    expectedStatus: "pending_review",
    finalDate: fixture.bookingDate,
    finalGuestStart,
    paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    operationId,
  };
}

test("Chinese party proposal, customer acceptance, in-store payment, conflict, and completion close once", async ({
  page,
}) => {
  let fixture: LiveBookingFixture | undefined;
  const email = `party-${crypto.randomUUID()}@example.test`;
  const conflictEmail = `party-conflict-${crypto.randomUUID()}@example.test`;
  try {
    fixture = await seedLiveBookingFixture({
      weeklyHours: APPROVED_WEEKLY_HOURS,
      projects: LIVE_DIY_PROJECTS,
      parties: LIVE_PARTY_PACKAGES,
      capabilities: { experience: true, party: true, product: false },
    });
    const bookingId = await createParty(page, fixture, email);
    const proposed = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      proposal(fixture, "12:30"),
    );
    expect(proposed.status()).toBe(200);
    const acceptToken = (await proposed.json()).data.acceptTimeToken as string;
    expect(acceptToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await waitForMailpitMessage({
      recipient: email,
      subjectIncludes: "建议的派对时间",
    });

    const accepted = await post(
      page,
      `/api/backend/v1/customer-bookings/${acceptToken}/accept-time`,
      {},
    );
    const replay = await post(
      page,
      `/api/backend/v1/customer-bookings/${acceptToken}/accept-time`,
      {},
    );
    expect(accepted.status()).toBe(200);
    expect(replay.status()).toBe(404);
    expect((await replay.json()).error.code).toBe("LINK_INVALID_OR_EXPIRED");

    const ordinary = await post(
      page,
      "/api/backend/v1/bookings",
      {
        kind: "experience",
        mode: "booking",
        name: `Party overlap ${fixture.runId}`,
        phone: "0430787731",
        email: conflictEmail,
        date: fixture.bookingDate,
        startTime: "12:30",
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
    expect(ordinary.status()).toBe(201);
    const ordinaryId = (await ordinary.json()).data.id as string;
    fixture.requestIds.add(ordinaryId);
    const conflict = await post(
      page,
      `/api/backend/v1/admin/bookings/${ordinaryId}/transitions`,
      {
        action: "transition",
        expectedStatus: "pending_review",
        toStatus: "confirmed",
        operationId: crypto.randomUUID(),
        newDate: fixture.bookingDate,
        newStartTime: "12:30",
      },
    );
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).error.code).toBe("CAPACITY_CONFLICT");

    const paymentOperation = crypto.randomUUID();
    const paymentBody = {
      expectedStatus: "awaiting_in_store_payment",
      amountCents: 9500,
      paidAt: new Date().toISOString(),
      operationId: paymentOperation,
    };
    const payment = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/payment`,
      paymentBody,
    );
    const paymentReplay = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/payment`,
      paymentBody,
    );
    expect(payment.status()).toBe(200);
    expect((await paymentReplay.json()).data.replayed).toBe(true);
    await waitForMailpitMessage({
      recipient: email,
      subjectIncludes: "派对付款已记录",
    });

    const completed = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      {
        action: "transition",
        expectedStatus: "confirmed_paid",
        toStatus: "completed",
        operationId: crypto.randomUUID(),
        note: "派对已完成",
      },
    );
    expect(completed.status()).toBe(200);
    const [finalState] = await fixture.sql<{
      status: string;
      venueFees: number;
      acceptedEvents: number;
      paymentEvents: number;
    }[]>`
      select
        b.status,
        (select count(*)::int from booking_charges c
          where c.booking_id = b.id and c.type = 'venue_fee') as "venueFees",
        (select count(*)::int from request_status_events e
          where e.booking_id = b.id and e.to_status = 'awaiting_in_store_payment') as "acceptedEvents",
        (select count(*)::int from request_status_events e
          where e.booking_id = b.id and e.to_status = 'confirmed_paid') as "paymentEvents"
      from bookings b where b.id = ${bookingId}
    `;
    expect(finalState).toEqual({
      status: "completed",
      venueFees: 1,
      acceptedEvents: 1,
      paymentEvents: 1,
    });
  } finally {
    await deleteMailpitMessagesFor([email, conflictEmail]);
    await fixture?.cleanup();
  }
});

test("paid party customer cancellation can be reviewed, cancelled, and refunded over 48 hours out", async ({
  page,
}) => {
  let fixture: LiveBookingFixture | undefined;
  const email = `party-refund-${crypto.randomUUID()}@example.test`;
  try {
    fixture = await seedLiveBookingFixture({
      weeklyHours: APPROVED_WEEKLY_HOURS,
      projects: LIVE_DIY_PROJECTS,
      parties: LIVE_PARTY_PACKAGES,
      capabilities: { experience: true, party: true, product: false },
    });
    const bookingId = await createParty(page, fixture, email);
    const acceptedDirectly = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
      proposal(fixture, "12:00"),
    );
    expect(acceptedDirectly.status()).toBe(200);
    const payment = await post(
      page,
      `/api/backend/v1/admin/bookings/${bookingId}/payment`,
      {
        expectedStatus: "awaiting_in_store_payment",
        amountCents: 9500,
        paidAt: new Date().toISOString(),
        operationId: crypto.randomUUID(),
      },
    );
    expect(payment.status()).toBe(200);
    const paymentMail = await waitForMailpitMessage({
      recipient: email,
      subjectIncludes: "派对付款已记录",
    });
    const manageToken = extractManagementToken(
      await readMailpitMessage(paymentMail),
    );
    const cancellation = await post(
      page,
      `/api/backend/v1/customer-bookings/${manageToken}/request-cancellation`,
      {},
    );
    const cancellationReplay = await post(
      page,
      `/api/backend/v1/customer-bookings/${manageToken}/request-cancellation`,
      {},
    );
    expect(cancellation.status()).toBe(200);
    expect(cancellationReplay.status()).toBe(403);

    expect(
      (
        await post(
          page,
          `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
          {
            action: "transition",
            expectedStatus: "cancellation_requested",
            toStatus: "cancelled",
            operationId: crypto.randomUUID(),
          },
        )
      ).status(),
    ).toBe(200);
    const refundOperation = crypto.randomUUID();
    const refundBody = {
      expectedStatus: "cancelled",
      refundedAt: new Date().toISOString(),
      operationId: refundOperation,
    };
    expect(
      (
        await post(
          page,
          `/api/backend/v1/admin/bookings/${bookingId}/refund`,
          refundBody,
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await post(
          page,
          `/api/backend/v1/admin/bookings/${bookingId}/refund`,
          refundBody,
        )
      ).status(),
    ).toBe(200);

    const [refunded] = await fixture.sql<{
      status: string;
      refunds: number;
      cancellationEvents: number;
      refundEvents: number;
    }[]>`
      select
        b.status,
        (select count(*)::int from booking_charges c
          where c.booking_id = b.id and c.type = 'refund') as refunds,
        (select count(*)::int from request_status_events e
          where e.booking_id = b.id and e.to_status = 'cancellation_requested') as "cancellationEvents",
        (select count(*)::int from request_status_events e
          where e.booking_id = b.id and e.to_status = 'refunded') as "refundEvents"
      from bookings b where b.id = ${bookingId}
    `;
    expect(refunded).toEqual({
      status: "refunded",
      refunds: 1,
      cancellationEvents: 1,
      refundEvents: 1,
    });
  } finally {
    await deleteMailpitMessagesFor([email]);
    await fixture?.cleanup();
  }
});

test("maintenance expires an unpaid party hold once", async ({ page }) => {
  let fixture: LiveBookingFixture | undefined;
  const email = `party-expiry-${crypto.randomUUID()}@example.test`;
  try {
    fixture = await seedLiveBookingFixture({
      weeklyHours: APPROVED_WEEKLY_HOURS,
      projects: LIVE_DIY_PROJECTS,
      parties: LIVE_PARTY_PACKAGES,
      capabilities: { experience: true, party: true, product: false },
    });
    const bookingId = await createParty(page, fixture, email);
    expect(
      (
        await post(
          page,
          `/api/backend/v1/admin/bookings/${bookingId}/transitions`,
          proposal(fixture, "12:00"),
        )
      ).status(),
    ).toBe(200);
    await fixture.sql`
      update booking_party_details
      set payment_deadline = now() - interval '1 minute'
      where booking_id = ${bookingId}
    `;
    const expired = await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{
        status: string;
        expiryEvents: number;
        expiryEmails: number;
      }[]>`
        select
          b.status,
          (select count(*)::int from request_status_events e
            where e.booking_id = b.id and e.to_status = 'payment_expired') as "expiryEvents",
          (select count(*)::int from email_outbox o
            where o.booking_id = b.id and o.payload->>'template' = 'party_payment_expired') as "expiryEmails"
        from bookings b where b.id = ${bookingId}
      `;
      return row?.status === "payment_expired" ? row : null;
    }, "expired unpaid party hold");
    expect(expired).toEqual({
      status: "payment_expired",
      expiryEvents: 1,
      expiryEmails: 1,
    });
  } finally {
    await deleteMailpitMessagesFor([email]);
    await fixture?.cleanup();
  }
});
