import type { Db } from "@yezz/db";
import { sql } from "drizzle-orm";
import { AppError } from "./errors.js";

export type PublicCreateNamespace = "booking" | "cart-order";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireIdempotencyKey(
  value: string | string[] | undefined,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !UUID_PATTERN.test(candidate)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Idempotency-Key must be a UUID",
    );
  }
  return candidate.toLowerCase();
}

export async function lockPublicCreateAttempt(
  tx: Db,
  namespace: PublicCreateNamespace,
  idempotencyKey: string,
): Promise<void> {
  const lockKey = `${namespace}-create:${idempotencyKey}`;
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
  );
}
