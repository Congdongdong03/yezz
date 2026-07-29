import { emailOutbox, requestStatusEvents, type Db } from "@yezz/db";
import { and, asc, count, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import { AppError } from "../lib/errors.js";
import {
  canonicalEmailPayload,
  validateEmailOutboxEnvelope,
  type ValidatedEmailOutboxEnvelope,
} from "../lib/email-outbox-payload.js";

export type EmailDeliveryStatus = "pending" | "processing" | "sent" | "failed";

export type EmailOutboxRow = typeof emailOutbox.$inferSelect & {
  deliveryStatus: EmailDeliveryStatus;
};

export type EnqueueEmailInput = {
  dedupeKey: string;
  bookingId?: string | null;
  cartOrderId?: string | null;
  statusEventId?: string | null;
  messageType: string;
  recipient: string;
  locale: string;
  payload: Record<string, unknown>;
};

export type EmailDeliveryListOptions = {
  page?: number;
  limit?: number;
  status?: EmailDeliveryStatus;
};

const LEASE_MILLISECONDS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LIFECYCLE_TEMPLATE_STATUS = {
  booking_confirmed: "confirmed",
  booking_rejected: "rejected",
  booking_waitlisted: "waitlisted",
  party_time_proposed: "time_proposed",
  party_payment_due: "awaiting_in_store_payment",
  party_payment_recorded: "confirmed_paid",
  party_payment_expired: "payment_expired",
  cancellation_request: "cancellation_requested",
  reschedule_request: "reschedule_requested",
} as const;

function normalizeListOptions(options: EmailDeliveryListOptions) {
  return {
    page: Math.max(1, options.page ?? 1),
    limit: Math.min(100, Math.max(1, options.limit ?? 25)),
    status: options.status,
  };
}

export function createEmailOutboxRepository(db: Db) {
  async function assertStatusEventIntegrity(
    tx: Db,
    validated: ValidatedEmailOutboxEnvelope,
  ): Promise<void> {
    if (!validated.statusEventId) return;

    const [event] = await tx
      .select({
        bookingId: requestStatusEvents.bookingId,
        cartOrderId: requestStatusEvents.cartOrderId,
        toStatus: requestStatusEvents.toStatus,
      })
      .from(requestStatusEvents)
      .where(eq(requestStatusEvents.id, validated.statusEventId))
      .limit(1)
      .for("share");
    const payloadStatus =
      validated.payload.template === "booking_status"
        ? validated.payload.status
        : validated.payload.template in LIFECYCLE_TEMPLATE_STATUS
          ? LIFECYCLE_TEMPLATE_STATUS[
              validated.payload
                .template as keyof typeof LIFECYCLE_TEMPLATE_STATUS
            ]
          : null;
    if (
      !event ||
      event.bookingId !== validated.bookingId ||
      event.cartOrderId !== validated.cartOrderId ||
      (payloadStatus !== null && event.toStatus !== payloadStatus)
    ) {
      throw new AppError(
        422,
        "INVALID_EMAIL_PAYLOAD",
        "Status event does not match the email request and status",
      );
    }
  }

  async function enqueueInTransaction(
    input: EnqueueEmailInput,
    tx: Db,
  ): Promise<EmailOutboxRow> {
    const validated = validateEmailOutboxEnvelope(input);
    await assertStatusEventIntegrity(tx, validated);

    const [inserted] = await tx
      .insert(emailOutbox)
      .values({
        dedupeKey: input.dedupeKey,
        bookingId: validated.bookingId,
        cartOrderId: validated.cartOrderId,
        statusEventId: validated.statusEventId,
        messageType: validated.messageType,
        recipient: validated.recipient,
        locale: validated.locale,
        payload: validated.payload,
        nextAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: emailOutbox.dedupeKey })
      .returning();

    if (inserted) return inserted as EmailOutboxRow;

    const [existing] = await tx
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.dedupeKey, input.dedupeKey))
      .limit(1);
    if (!existing) {
      throw new AppError(
        409,
        "EMAIL_DEDUPE_CONFLICT",
        "The email delivery could not be resolved",
      );
    }
    const sameImmutableContent =
      existing.bookingId === validated.bookingId &&
      existing.cartOrderId === validated.cartOrderId &&
      existing.statusEventId === validated.statusEventId &&
      existing.messageType === validated.messageType &&
      existing.recipient === validated.recipient &&
      existing.locale === validated.locale &&
      canonicalEmailPayload(existing.payload as typeof validated.payload) ===
        canonicalEmailPayload(validated.payload);
    if (!sameImmutableContent) {
      throw new AppError(
        409,
        "EMAIL_DEDUPE_CONFLICT",
        "The email dedupe key belongs to different immutable content",
      );
    }
    return existing as EmailOutboxRow;
  }

  return {
    async enqueue(input: EnqueueEmailInput, tx?: Db): Promise<EmailOutboxRow> {
      if (tx) return enqueueInTransaction(input, tx);
      return db.transaction((transaction) =>
        enqueueInTransaction(input, transaction as unknown as Db),
      );
    },

    async claimDue(limit = 20, now = new Date()): Promise<EmailOutboxRow[]> {
      const boundedLimit = Math.min(20, Math.max(1, limit));
      const leaseExpiresAt = new Date(now.getTime() + LEASE_MILLISECONDS);

      return db.transaction(async (tx) => {
        const due = await tx
          .select({ id: emailOutbox.id })
          .from(emailOutbox)
          .where(
            and(
              lt(emailOutbox.attemptCount, MAX_ATTEMPTS),
              or(
                and(
                  eq(emailOutbox.deliveryStatus, "pending"),
                  lte(emailOutbox.nextAttemptAt, now),
                ),
                and(
                  eq(emailOutbox.deliveryStatus, "processing"),
                  lte(emailOutbox.leaseExpiresAt, now),
                ),
              ),
            ),
          )
          .orderBy(asc(emailOutbox.nextAttemptAt), asc(emailOutbox.createdAt))
          .limit(boundedLimit)
          .for("update", { skipLocked: true });

        if (due.length === 0) return [];

        const rows = await tx
          .update(emailOutbox)
          .set({
            deliveryStatus: "processing",
            leaseExpiresAt,
            updatedAt: now,
          })
          .where(
            inArray(
              emailOutbox.id,
              due.map(({ id }) => id),
            ),
          )
          .returning();
        return rows as EmailOutboxRow[];
      });
    },

    async findById(id: string): Promise<EmailOutboxRow | null> {
      const [row] = await db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.id, id))
        .limit(1);
      return (row as EmailOutboxRow | undefined) ?? null;
    },

    async list(options: EmailDeliveryListOptions = {}) {
      const normalized = normalizeListOptions(options);
      const condition = normalized.status
        ? eq(emailOutbox.deliveryStatus, normalized.status)
        : sql`true`;
      const [totalRow] = await db
        .select({ total: count() })
        .from(emailOutbox)
        .where(condition);
      const rows = await db
        .select()
        .from(emailOutbox)
        .where(condition)
        .orderBy(asc(emailOutbox.deliveryStatus), asc(emailOutbox.createdAt))
        .limit(normalized.limit)
        .offset((normalized.page - 1) * normalized.limit);

      return {
        data: rows as EmailOutboxRow[],
        total: Number(totalRow?.total ?? 0),
        page: normalized.page,
        limit: normalized.limit,
      };
    },

    async markSent(input: {
      id: string;
      expectedLeaseExpiresAt: Date;
      providerMessageId: string;
      sentAt: Date;
    }): Promise<EmailOutboxRow | null> {
      const [row] = await db
        .update(emailOutbox)
        .set({
          deliveryStatus: "sent",
          attemptCount: sql`${emailOutbox.attemptCount} + 1`,
          providerMessageId: input.providerMessageId,
          sentAt: input.sentAt,
          leaseExpiresAt: null,
          lastError: null,
          updatedAt: input.sentAt,
        })
        .where(
          and(
            eq(emailOutbox.id, input.id),
            eq(emailOutbox.deliveryStatus, "processing"),
            eq(emailOutbox.leaseExpiresAt, input.expectedLeaseExpiresAt),
          ),
        )
        .returning();
      return (row as EmailOutboxRow | undefined) ?? null;
    },

    async markFailed(input: {
      id: string;
      expectedLeaseExpiresAt: Date;
      deliveryStatus: "pending" | "failed";
      nextAttemptAt: Date;
      safeError: string;
      failedAt: Date;
    }): Promise<EmailOutboxRow | null> {
      const [row] = await db
        .update(emailOutbox)
        .set({
          deliveryStatus: input.deliveryStatus,
          attemptCount: sql`${emailOutbox.attemptCount} + 1`,
          nextAttemptAt: input.nextAttemptAt,
          leaseExpiresAt: null,
          lastError: input.safeError,
          updatedAt: input.failedAt,
        })
        .where(
          and(
            eq(emailOutbox.id, input.id),
            eq(emailOutbox.deliveryStatus, "processing"),
            eq(emailOutbox.leaseExpiresAt, input.expectedLeaseExpiresAt),
          ),
        )
        .returning();
      return (row as EmailOutboxRow | undefined) ?? null;
    },

    async retry(id: string, now = new Date()): Promise<EmailOutboxRow> {
      const existing = await this.findById(id);
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

      const [row] = await db
        .update(emailOutbox)
        .set({
          deliveryStatus: "pending",
          attemptCount: 0,
          nextAttemptAt: now,
          leaseExpiresAt: null,
          providerMessageId: null,
          sentAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(emailOutbox.id, id),
            eq(emailOutbox.deliveryStatus, existing.deliveryStatus),
          ),
        )
        .returning();
      if (!row) {
        throw new AppError(
          409,
          "EMAIL_DELIVERY_CONFLICT",
          "Email delivery changed before retry",
        );
      }
      return row as EmailOutboxRow;
    },
  };
}

export type EmailOutboxRepository = ReturnType<
  typeof createEmailOutboxRepository
>;
