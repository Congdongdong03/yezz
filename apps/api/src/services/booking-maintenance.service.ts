import { createHash, createHmac } from "node:crypto";
import type {
  BookingMaintenanceRepository,
  BookingReminderCandidate,
  ExpiredPartyHold,
} from "../repositories/booking-maintenance.repository.js";
import { safeWorkerDiagnostic } from "./email-outbox.service.js";

type MaintenanceRepository = Pick<
  BookingMaintenanceRepository,
  | "findExpiredPartyHolds"
  | "findBookingsNeedingReminder"
  | "markReminderEnqueued"
>;

type PartyExpiryWorkflow = {
  expirePartyHold(input: {
    bookingId: string;
    expectedStatus: "awaiting_in_store_payment";
    operationId: string;
    actorUserId: null;
  }): Promise<unknown>;
};

type BookingMaintenanceOptions = {
  now?: () => Date;
  customerActionTokenSecret?: string;
  customerManageBaseUrl?: string;
};

function deterministicUuid(value: string): string {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function expiryOperationId(candidate: ExpiredPartyHold): string {
  return deterministicUuid(
    `booking-maintenance-expiry:${candidate.bookingId}:${candidate.paymentDeadline.toISOString()}`,
  );
}

function assertSecret(value: string | undefined): string {
  if (!value || Buffer.byteLength(value) < 32) {
    throw new Error(
      "CUSTOMER_ACTION_TOKEN_SECRET must be at least 32 bytes for booking reminders",
    );
  }
  return value;
}

function customerCredential(
  candidate: BookingReminderCandidate,
  secret: string,
): { rawToken: string; tokenDigest: string } {
  const rawToken = createHmac("sha256", secret)
    .update(
      `booking-reminder:${candidate.bookingId}:${candidate.date}:${candidate.startTime}`,
    )
    .digest("base64url");
  return {
    rawToken,
    tokenDigest: createHash("sha256").update(rawToken).digest("hex"),
  };
}

function manageUrl(
  candidate: BookingReminderCandidate,
  rawToken: string,
  configuredBaseUrl: string,
): string {
  const base = new URL(configuredBaseUrl);
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("Customer management base URL must use http(s)");
  }
  const prefix = base.pathname.replace(/\/$/, "");
  base.pathname = `${prefix}/${candidate.locale}/manage-booking/${rawToken}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

export function createBookingMaintenanceService(
  repository: MaintenanceRepository,
  partyWorkflow: PartyExpiryWorkflow,
  options: BookingMaintenanceOptions = {},
) {
  const now = options.now ?? (() => new Date());
  const tokenSecret =
    options.customerActionTokenSecret ??
    process.env.CUSTOMER_ACTION_TOKEN_SECRET;
  const customerManageBaseUrl =
    options.customerManageBaseUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  let activeRun: Promise<{
    expired: number;
    remindersEnqueued: number;
  }> | null = null;

  async function performRun() {
    const current = now();
    const expiredHolds = await repository.findExpiredPartyHolds(current);
    for (const candidate of expiredHolds) {
      await partyWorkflow.expirePartyHold({
        bookingId: candidate.bookingId,
        expectedStatus: "awaiting_in_store_payment",
        operationId: expiryOperationId(candidate),
        actorUserId: null,
      });
    }

    const reminders = await repository.findBookingsNeedingReminder(current);
    let remindersEnqueued = 0;
    if (reminders.length > 0) {
      const secret = assertSecret(tokenSecret);
      for (const candidate of reminders) {
        const credential = customerCredential(candidate, secret);
        const inserted = await repository.markReminderEnqueued(
          {
            ...candidate,
            ...credential,
            manageUrl: manageUrl(
              candidate,
              credential.rawToken,
              customerManageBaseUrl,
            ),
          },
          current,
        );
        if (inserted) remindersEnqueued += 1;
      }
    }
    return { expired: expiredHolds.length, remindersEnqueued };
  }

  return {
    runOnce(): Promise<{ expired: number; remindersEnqueued: number }> {
      if (activeRun) return activeRun;
      activeRun = performRun().finally(() => {
        activeRun = null;
      });
      return activeRun;
    },
  };
}

export type BookingMaintenanceService = ReturnType<
  typeof createBookingMaintenanceService
>;

const DEFAULT_POLL_MILLISECONDS = 60_000;

export function startBookingMaintenanceWorker(
  service: Pick<BookingMaintenanceService, "runOnce">,
  onError: (
    diagnostic: ReturnType<typeof safeWorkerDiagnostic>,
  ) => void = () => {},
  options: { pollMilliseconds?: number } = {},
): () => Promise<void> {
  const pollMilliseconds =
    Number.isInteger(options.pollMilliseconds) &&
    Number(options.pollMilliseconds) > 0
      ? Number(options.pollMilliseconds)
      : DEFAULT_POLL_MILLISECONDS;
  let stopped = false;
  let activePoll: Promise<unknown> = Promise.resolve();
  const poll = () => {
    if (stopped) return;
    activePoll = service
      .runOnce()
      .catch((error) => onError(safeWorkerDiagnostic(error)));
  };
  poll();
  const timer = setInterval(poll, pollMilliseconds);
  return async () => {
    stopped = true;
    clearInterval(timer);
    await activePoll;
  };
}
