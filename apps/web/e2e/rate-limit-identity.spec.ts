import { expect, test } from "@playwright/test";
import {
  createClosureFixture,
  type ClosureFixture,
} from "./fixtures/closure-database";
import { closureContact } from "./fixtures/closure-ui";
import { deleteMailpitMessagesFor } from "./fixtures/mailpit";

test("durable request rate limiting separates trusted BFF client identities", async ({
  request,
}) => {
  let fixture: ClosureFixture | undefined;
  let recipients: string[] = [];
  try {
    fixture = await createClosureFixture("experience", { capacity: 20 });
    const contact = closureContact(fixture.label);
    recipients = [contact.email];
    const identityA = "203.0.113.41";
    const identityB = "203.0.113.42";
    fixture.rateLimitSubjects.add(`booking\n${identityA}`);
    fixture.rateLimitSubjects.add(`booking\n${identityB}`);

    const submit = async (identity: string) =>
      request.post("/api/backend/v1/bookings", {
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
          Origin: process.env.NEXT_PUBLIC_SITE_URL!,
          "x-vercel-forwarded-for": identity,
        },
        data: {
          kind: "experience",
          mode: "booking",
          date: fixture!.slotDate,
          startTime: fixture!.slotStartTime,
          participantCount: 1,
          youngChildCount: 0,
          accompanyingAdultCount: 0,
          items: [{ projectId: fixture!.projectId!, quantity: 1 }],
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          locale: "en",
          policyVersion: "2026-08-03",
          policyAccepted: true,
        },
      });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await submit(identityA);
      expect(response.status(), `identity A request ${attempt}`).toBe(201);
      const payload = (await response.json()) as {
        success: boolean;
        data: { id: string };
      };
      expect(payload.success).toBe(true);
      fixture.requestIds.add(payload.data.id);
    }

    const blocked = await submit(identityA);
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
    await expect(blocked.json()).resolves.toMatchObject({
      success: false,
      error: { code: "RATE_LIMITED" },
    });

    const otherIdentity = await submit(identityB);
    expect(otherIdentity.status()).toBe(201);
    const otherPayload = (await otherIdentity.json()) as {
      success: boolean;
      data: { id: string };
    };
    expect(otherPayload.success).toBe(true);
    fixture.requestIds.add(otherPayload.data.id);

    const [state] = await fixture.sql<
      {
      requestCount: number;
      identityBuckets: number;
      }[]
    >`
      select
        (
          select count(*)::int
          from bookings
          where id = any(${[...fixture.requestIds]}::uuid[])
        ) as "requestCount",
        (
          select count(*)::int
          from request_rate_limits
          where scope = 'booking'
        ) as "identityBuckets"
    `;
    expect(state).toMatchObject({
      requestCount: 6,
      identityBuckets: 2,
    });
  } finally {
    await deleteMailpitMessagesFor(recipients);
    await fixture?.cleanup();
  }
});
