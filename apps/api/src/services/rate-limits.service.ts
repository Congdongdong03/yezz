import { createHmac } from "node:crypto";
import { AppError } from "../lib/errors.js";
import type { RateLimitsRepository } from "../repositories/rate-limits.repository.js";

const MINIMUM_HASH_SECRET_BYTES = 32;
const MINIMUM_DISTINCT_SECRET_CHARACTERS = 8;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  resetAfter: number;
  retryAfter?: number;
};

export type RateLimitsService = {
  consume(
    scope: string,
    subject: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult>;
  purgeExpired(): Promise<void>;
};

type RateLimitsServiceOptions = {
  hashSecret: string | undefined;
  now?: () => Date;
};

function unavailable(): AppError {
  return new AppError(
    503,
    "RATE_LIMIT_UNAVAILABLE",
    "Please try again shortly.",
  );
}

function validateSecret(secret: string | undefined): string {
  if (
    !secret ||
    secret.trim().length === 0 ||
    Buffer.byteLength(secret, "utf8") < MINIMUM_HASH_SECRET_BYTES ||
    new Set(secret).size < MINIMUM_DISTINCT_SECRET_CHARACTERS
  ) {
    throw unavailable();
  }
  return secret;
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function validateConsumption(
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): { scope: string; subject: string } {
  const normalizedScope = normalize(scope);
  const normalizedSubject = normalize(subject);
  if (
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(normalizedScope) ||
    normalizedSubject.length === 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(windowSeconds) ||
    windowSeconds < 1
  ) {
    throw unavailable();
  }
  return { scope: normalizedScope, subject: normalizedSubject };
}

export function createRateLimitsService(
  repository: RateLimitsRepository,
  options: RateLimitsServiceOptions,
): RateLimitsService {
  return {
    async consume(scope, subject, limit, windowSeconds) {
      try {
        const secret = validateSecret(options.hashSecret);
        const normalized = validateConsumption(
          scope,
          subject,
          limit,
          windowSeconds,
        );
        const now = options.now?.() ?? new Date();
        const subjectHash = createHmac("sha256", secret)
          .update(`${normalized.scope}\n${normalized.subject}`)
          .digest("hex");
        const bucket = await repository.consume({
          scope: normalized.scope,
          subjectHash,
          limit,
          windowSeconds,
          now,
        });
        const remaining = Math.max(0, limit - bucket.requestCount);
        const resetAfter = Math.max(
          1,
          Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000),
        );
        const retryAfter = bucket.consumed ? undefined : resetAfter;

        return {
          allowed: bucket.consumed,
          limit,
          remaining,
          resetAt: bucket.expiresAt,
          resetAfter,
          ...(retryAfter === undefined ? {} : { retryAfter }),
        };
      } catch {
        throw unavailable();
      }
    },

    async purgeExpired() {
      await repository.purgeExpired(options.now?.() ?? new Date());
    },
  };
}

type RateLimitMaintenanceOptions = {
  intervalMs?: number;
  onError?: () => void;
};

const DAILY_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function scheduleRateLimitMaintenance(
  service: Pick<RateLimitsService, "purgeExpired">,
  options: RateLimitMaintenanceOptions = {},
): () => void {
  const timer = setInterval(() => {
    void service.purgeExpired().catch(() => {
      options.onError?.();
    });
  }, options.intervalMs ?? DAILY_MAINTENANCE_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
