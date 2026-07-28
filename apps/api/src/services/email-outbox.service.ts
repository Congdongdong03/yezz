import { AppError } from "../lib/errors.js";
import {
  validateEmailOutboxEnvelope,
  type EmailTemplatePayload,
} from "../lib/email-outbox-payload.js";
import type {
  EmailOutboxRepository as DatabaseEmailOutboxRepository,
  EmailOutboxRow,
  EnqueueEmailInput,
} from "../repositories/email-outbox.repository.js";

export type { EmailOutboxRow };

export type OutboxProviderMessage = Pick<
  EmailOutboxRow,
  | "id"
  | "dedupeKey"
  | "bookingId"
  | "cartOrderId"
  | "statusEventId"
  | "messageType"
  | "recipient"
  | "locale"
  | "payload"
>;

export type EmailOutboxProvider = {
  send(message: OutboxProviderMessage): Promise<{ providerMessageId: string }>;
};

export type EmailOutboxRepository = Pick<
  DatabaseEmailOutboxRepository,
  | "enqueue"
  | "claimDue"
  | "findById"
  | "list"
  | "markSent"
  | "markFailed"
  | "retry"
>;

export const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240] as const;
const MAX_ATTEMPTS = 5;

export type EnqueueOutboxInput = Omit<EnqueueEmailInput, "payload"> & {
  payload: EmailTemplatePayload;
};

function errorMetadata(error: unknown): {
  statusCode?: number;
  code?: string;
  message: string;
} {
  if (!(error instanceof Error)) return { message: "provider error" };
  const candidate = error as Error & {
    statusCode?: unknown;
    status?: unknown;
    code?: unknown;
  };
  const rawStatus = candidate.statusCode ?? candidate.status;
  return {
    statusCode:
      typeof rawStatus === "number" && Number.isFinite(rawStatus)
        ? rawStatus
        : undefined,
    code:
      typeof candidate.code === "string"
        ? candidate.code.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
        : undefined,
    message: candidate.message,
  };
}

export function safeDeliveryError(error: unknown): string {
  const metadata = errorMetadata(error);
  const prefix = [metadata.statusCode, metadata.code].filter(Boolean).join(" ");
  const safeMessage = metadata.message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${prefix}${prefix ? ": " : ""}${safeMessage || "provider error"}`.slice(
    0,
    300,
  );
}

function isTransientProviderError(error: unknown): boolean {
  const { statusCode, code } = errorMetadata(error);
  if (
    code?.startsWith("smtp_") &&
    code.endsWith("_rejected") &&
    statusCode !== undefined &&
    statusCode >= 400 &&
    statusCode <= 599
  ) {
    return statusCode < 500;
  }
  return (
    statusCode === undefined ||
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

export function createEmailOutboxService(
  repo: EmailOutboxRepository,
  provider: EmailOutboxProvider,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());
  let activeDrain: Promise<number> | null = null;

  async function deliverOne(
    row: EmailOutboxRow,
  ): Promise<EmailOutboxRow | null> {
    if (row.deliveryStatus !== "processing" || !row.leaseExpiresAt) {
      throw new AppError(
        409,
        "EMAIL_NOT_CLAIMED",
        "Email delivery must be claimed before sending",
      );
    }

    const attemptedAt = now();
    try {
      const validated = validateEmailOutboxEnvelope(row);
      const result = await provider.send({
        id: row.id,
        dedupeKey: row.dedupeKey,
        bookingId: validated.bookingId,
        cartOrderId: validated.cartOrderId,
        statusEventId: validated.statusEventId,
        messageType: validated.messageType,
        recipient: validated.recipient,
        locale: validated.locale,
        payload: validated.payload,
      });
      return repo.markSent({
        id: row.id,
        expectedLeaseExpiresAt: row.leaseExpiresAt,
        providerMessageId: result.providerMessageId,
        sentAt: attemptedAt,
      });
    } catch (error) {
      const nextAttemptCount = row.attemptCount + 1;
      const transient = isTransientProviderError(error);
      const exhausted = nextAttemptCount >= MAX_ATTEMPTS;
      const delayIndex = Math.min(
        nextAttemptCount - 1,
        RETRY_DELAYS_MINUTES.length - 1,
      );
      const nextAttemptAt = new Date(
        attemptedAt.getTime() + RETRY_DELAYS_MINUTES[delayIndex] * 60_000,
      );
      return repo.markFailed({
        id: row.id,
        expectedLeaseExpiresAt: row.leaseExpiresAt,
        deliveryStatus: transient && !exhausted ? "pending" : "failed",
        nextAttemptAt,
        safeError: safeDeliveryError(error),
        failedAt: attemptedAt,
      });
    }
  }

  async function performDrain(): Promise<number> {
    const rows = await repo.claimDue(20, now());
    for (const row of rows) {
      await deliverOne(row);
    }
    return rows.length;
  }

  return {
    enqueue(
      input: EnqueueOutboxInput,
      tx?: Parameters<EmailOutboxRepository["enqueue"]>[1],
    ) {
      return repo.enqueue(input, tx);
    },

    deliverOne,

    drain(): Promise<number> {
      if (activeDrain) return activeDrain.then(() => 0);
      activeDrain = performDrain().finally(() => {
        activeDrain = null;
      });
      return activeDrain;
    },

    list: repo.list.bind(repo),

    async retry(id: string): Promise<EmailOutboxRow> {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(
          404,
          "EMAIL_DELIVERY_NOT_FOUND",
          "Email delivery not found",
        );
      }
      if (existing.deliveryStatus === "sent") {
        throw new AppError(
          409,
          "EMAIL_ALREADY_SENT",
          "Sent email cannot be retried",
        );
      }
      if (existing.deliveryStatus === "processing") {
        throw new AppError(
          409,
          "EMAIL_DELIVERY_IN_PROGRESS",
          "Email delivery is currently being processed",
        );
      }
      if (existing.deliveryStatus !== "failed") {
        throw new AppError(
          409,
          "EMAIL_NOT_FAILED",
          "Only a failed email delivery can be retried manually",
        );
      }
      return repo.retry(id, now());
    },
  };
}

export type EmailOutboxService = ReturnType<typeof createEmailOutboxService>;

export function safeWorkerDiagnostic(error: unknown): {
  name: string;
  code?: string;
  statusCode?: number;
} {
  const candidate =
    typeof error === "object" && error !== null
      ? (error as {
          name?: unknown;
          code?: unknown;
          statusCode?: unknown;
          status?: unknown;
        })
      : {};
  const code =
    typeof candidate.code === "string"
      ? candidate.code.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
      : undefined;
  const rawStatus = candidate.statusCode ?? candidate.status;
  const statusCode =
    typeof rawStatus === "number" && Number.isFinite(rawStatus)
      ? rawStatus
      : undefined;
  return {
    name:
      typeof candidate.name === "string"
        ? candidate.name.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
        : "UnknownError",
    ...(code ? { code } : {}),
    ...(statusCode !== undefined ? { statusCode } : {}),
  };
}

const WORKER_POLL_MILLISECONDS = 30_000;

export function startEmailOutboxWorker(
  service: Pick<EmailOutboxService, "drain">,
  onError: (error: unknown) => void = () => {},
  options: { pollMilliseconds?: number } = {},
): () => Promise<void> {
  const pollMilliseconds =
    Number.isInteger(options.pollMilliseconds) &&
    Number(options.pollMilliseconds) > 0
      ? Number(options.pollMilliseconds)
      : WORKER_POLL_MILLISECONDS;
  let stopped = false;
  let activePoll: Promise<unknown> = Promise.resolve();
  const drain = () => {
    if (stopped) return;
    activePoll = service.drain().catch(onError);
  };
  drain();
  const timer = setInterval(drain, pollMilliseconds);
  return async () => {
    stopped = true;
    clearInterval(timer);
    await activePoll;
  };
}
