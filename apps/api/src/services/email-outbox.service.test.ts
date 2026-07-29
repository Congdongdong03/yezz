import { describe, expect, it, vi } from "vitest";
import {
  createEmailOutboxService,
  safeWorkerDiagnostic,
  startEmailOutboxWorker,
  type EmailOutboxRepository,
  type EmailOutboxRow,
} from "./email-outbox.service.js";

const NOW = new Date("2026-07-28T02:00:00.000Z");

const VALID_BOOKING_RECEIVED_PAYLOAD = {
  template: "booking_received",
  storeName: "YezYY",
  orderId: "00000000-0000-4000-8000-000000000002",
  orderNumber: "booking-20260728-1234",
  submittedAt: "2026-07-28T02:00:00.000Z",
  input: {
    name: "Customer",
    phone: "0430000000",
    locale: "en",
  },
  contact: {
    email: "congdongdong03@gmail.com",
    phone: "0430 787 712",
  },
};

function pendingRow(overrides: Partial<EmailOutboxRow> = {}): EmailOutboxRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    dedupeKey: "booking:1:received:customer",
    bookingId: "00000000-0000-4000-8000-000000000002",
    cartOrderId: null,
    statusEventId: null,
    messageType: "booking_received_customer",
    recipient: "customer@example.test",
    locale: "en",
    payload: VALID_BOOKING_RECEIVED_PAYLOAD,
    deliveryStatus: "processing",
    attemptCount: 0,
    nextAttemptAt: NOW,
    leaseExpiresAt: new Date("2026-07-28T02:05:00.000Z"),
    providerMessageId: null,
    lastError: null,
    sentAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createMemoryRepository(row = pendingRow()): EmailOutboxRepository & {
  current: EmailOutboxRow;
} {
  let current = row;
  return {
    get current() {
      return current;
    },
    enqueue: vi.fn(),
    claimDue: vi.fn(async () => [current]),
    findById: vi.fn(async () => current),
    list: vi.fn(),
    markSent: vi.fn(async (input) => {
      current = {
        ...current,
        deliveryStatus: "sent",
        attemptCount: current.attemptCount + 1,
        providerMessageId: input.providerMessageId,
        sentAt: input.sentAt,
        leaseExpiresAt: null,
        lastError: null,
      };
      return current;
    }),
    markFailed: vi.fn(async (input) => {
      current = {
        ...current,
        deliveryStatus: input.deliveryStatus,
        attemptCount: current.attemptCount + 1,
        nextAttemptAt: input.nextAttemptAt,
        leaseExpiresAt: null,
        lastError: input.safeError,
      };
      return current;
    }),
    retry: vi.fn(async (_id, now) => {
      current = {
        ...current,
        deliveryStatus: "pending",
        attemptCount: 0,
        nextAttemptAt: now,
        leaseExpiresAt: null,
      };
      return current;
    }),
  };
}

describe("email outbox delivery state machine", () => {
  it("records the provider message ID after a successful send", async () => {
    const repo = createMemoryRepository();
    const provider = {
      send: vi.fn(async () => ({ providerMessageId: "resend-message-123" })),
    };
    const service = createEmailOutboxService(repo, provider, {
      now: () => NOW,
    });

    await service.deliverOne(repo.current);

    expect(repo.current).toMatchObject({
      deliveryStatus: "sent",
      attemptCount: 1,
      providerMessageId: "resend-message-123",
      sentAt: NOW,
    });
  });

  it("moves a transient failure to the next bounded retry", async () => {
    const repo = createMemoryRepository();
    const provider = {
      send: vi.fn(async () => {
        throw Object.assign(new Error("provider unavailable"), {
          statusCode: 503,
          code: "service_unavailable",
        });
      }),
    };
    const service = createEmailOutboxService(repo, provider, {
      now: () => NOW,
    });

    await service.deliverOne(repo.current);

    expect(repo.current).toMatchObject({
      deliveryStatus: "pending",
      attemptCount: 1,
      nextAttemptAt: new Date("2026-07-28T02:01:00.000Z"),
      lastError: "503 service_unavailable: provider unavailable",
    });
  });

  it("leaves a transient message failed after exactly five attempts", async () => {
    const repo = createMemoryRepository(pendingRow({ attemptCount: 4 }));
    const provider = {
      send: vi.fn(async () => {
        throw Object.assign(new Error("temporarily unavailable"), {
          statusCode: 503,
        });
      }),
    };
    const service = createEmailOutboxService(repo, provider, {
      now: () => NOW,
    });

    await service.deliverOne(repo.current);

    expect(repo.current).toMatchObject({
      deliveryStatus: "failed",
      attemptCount: 5,
      nextAttemptAt: new Date("2026-07-28T06:00:00.000Z"),
    });
  });

  it("fails an invalid-recipient provider response without a tight retry loop", async () => {
    const repo = createMemoryRepository();
    const provider = {
      send: vi.fn(async () => {
        throw Object.assign(new Error("recipient rejected"), {
          statusCode: 422,
          code: "invalid_to_address",
        });
      }),
    };
    const service = createEmailOutboxService(repo, provider, {
      now: () => NOW,
    });

    await service.deliverOne(repo.current);

    expect(repo.current).toMatchObject({
      deliveryStatus: "failed",
      attemptCount: 1,
      lastError: "422 invalid_to_address: recipient rejected",
    });
  });

  it("treats a permanent SMTP 550 recipient rejection as failed", async () => {
    const repo = createMemoryRepository();
    const provider = {
      send: vi.fn(async () => {
        throw Object.assign(new Error("SMTP recipient rejected with 550"), {
          statusCode: 550,
          code: "smtp_recipient_rejected",
        });
      }),
    };
    const service = createEmailOutboxService(repo, provider, {
      now: () => NOW,
    });

    await service.deliverOne(repo.current);

    expect(repo.current).toMatchObject({
      deliveryStatus: "failed",
      attemptCount: 1,
      lastError:
        "550 smtp_recipient_rejected: SMTP recipient rejected with 550",
    });
  });

  it("fails malformed persisted template data once without calling the provider", async () => {
    const repo = createMemoryRepository(
      pendingRow({
        payload: {
          template: "booking_received",
          orderNumber: "missing required fields",
        },
      }),
    );
    const provider = {
      send: vi.fn(async () => ({ providerMessageId: "must-not-send" })),
    };
    const service = createEmailOutboxService(repo, provider, {
      now: () => NOW,
    });

    await service.deliverOne(repo.current);

    expect(provider.send).not.toHaveBeenCalled();
    expect(repo.current).toMatchObject({
      deliveryStatus: "failed",
      attemptCount: 1,
    });
    expect(repo.current.lastError).toContain("INVALID_EMAIL_PAYLOAD");
    expect(repo.current.lastError).not.toContain("TypeError");
  });

  it("validates a typed booking notification before repository enqueue", async () => {
    const repo = createMemoryRepository();
    const service = createEmailOutboxService(repo, { send: vi.fn() });

    expect(() =>
      service.enqueue({
        dedupeKey: "booking:1:reminder:customer",
        bookingId: "00000000-0000-4000-8000-000000000002",
        messageType: "booking_notification_customer",
        recipient: "customer@example.com",
        locale: "en",
        payload: {
          template: "booking_reminder",
          customerName: "Customer",
          bookingNumber: "booking-20260729-0000",
          offeringLabel: "DIY",
          date: "2026-08-02",
          startTime: "13:00",
          endTime: "14:00",
          manageUrl: "javascript:alert(1)",
          storeName: "YezYY",
          contactEmail: "congdongdong03@gmail.com",
          contactPhone: "0430 787 712",
        },
      } as never),
    ).toThrow(expect.objectContaining({ code: "INVALID_EMAIL_PAYLOAD" }));
    expect(repo.enqueue).not.toHaveBeenCalled();
  });

  it("stores only a safe 300-character error without payload or recipient", async () => {
    const repo = createMemoryRepository();
    const secret = "sensitive-customer-message";
    const provider = {
      send: vi.fn(async () => {
        throw new Error(`${secret}${"x".repeat(500)}`);
      }),
    };
    const service = createEmailOutboxService(repo, provider, {
      now: () => NOW,
    });

    await service.deliverOne(repo.current);

    expect(repo.current.lastError?.length).toBeLessThanOrEqual(300);
    expect(repo.current.lastError).not.toContain(secret);
    expect(repo.current.lastError).not.toContain("customer@example.test");
  });

  it("does not retry a sent message", async () => {
    const repo = createMemoryRepository(
      pendingRow({ deliveryStatus: "sent", sentAt: NOW }),
    );
    const service = createEmailOutboxService(
      repo,
      { send: vi.fn() },
      { now: () => NOW },
    );

    await expect(service.retry(repo.current.id)).rejects.toMatchObject({
      code: "EMAIL_ALREADY_SENT",
    });
  });

  it("only permits manual retry after a delivery has failed", async () => {
    const repo = createMemoryRepository(
      pendingRow({ deliveryStatus: "pending", leaseExpiresAt: null }),
    );
    const service = createEmailOutboxService(
      repo,
      { send: vi.fn() },
      { now: () => NOW },
    );

    await expect(service.retry(repo.current.id)).rejects.toMatchObject({
      code: "EMAIL_NOT_FAILED",
    });
  });

  it("resets a failed row for a fresh manual retry without creating a duplicate", async () => {
    const repo = createMemoryRepository(
      pendingRow({ deliveryStatus: "failed", attemptCount: 5 }),
    );
    const service = createEmailOutboxService(
      repo,
      { send: vi.fn() },
      { now: () => NOW },
    );

    const retried = await service.retry(repo.current.id);

    expect(retried).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      dedupeKey: "booking:1:received:customer",
      deliveryStatus: "pending",
      attemptCount: 0,
      nextAttemptAt: NOW,
    });
    expect(repo.enqueue).not.toHaveBeenCalled();
  });

  it("does not overlap worker polls", async () => {
    let releaseClaim: (() => void) | undefined;
    const claimGate = new Promise<void>((resolve) => {
      releaseClaim = resolve;
    });
    const repo = createMemoryRepository();
    repo.claimDue = vi.fn(async () => {
      await claimGate;
      return [];
    });
    const service = createEmailOutboxService(
      repo,
      { send: vi.fn() },
      { now: () => NOW },
    );

    const first = service.drain();
    const second = service.drain();
    releaseClaim?.();
    await Promise.all([first, second]);

    expect(repo.claimDue).toHaveBeenCalledTimes(1);
  });

  it("drains immediately, polls every 30 seconds, and stops cleanly", async () => {
    vi.useFakeTimers();
    const drain = vi.fn(async () => 0);
    const stop = startEmailOutboxWorker({ drain });

    await vi.runAllTicks();
    expect(drain).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(drain).toHaveBeenCalledTimes(2);

    await stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(drain).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("allows the isolated closure harness to use a short poll interval", async () => {
    vi.useFakeTimers();
    const drain = vi.fn(async () => 0);
    const stop = startEmailOutboxWorker(
      { drain },
      () => {},
      { pollMilliseconds: 50 },
    );

    await vi.runAllTicks();
    expect(drain).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(49);
    expect(drain).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(drain).toHaveBeenCalledTimes(2);

    await stop();
    vi.useRealTimers();
  });

  it("retains only safe status and code context for worker diagnostics", () => {
    const diagnostic = safeWorkerDiagnostic(
      Object.assign(new Error("customer@example.test secret payload"), {
        code: "connection_failed",
        statusCode: 503,
      }),
    );

    expect(diagnostic).toEqual({
      name: "Error",
      code: "connection_failed",
      statusCode: 503,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("customer@example.test");
  });
});
