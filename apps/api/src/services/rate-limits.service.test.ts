import { describe, expect, it, vi } from "vitest";
import type {
  RateLimitBucketInput,
  RateLimitsRepository,
} from "../repositories/rate-limits.repository.js";
import {
  createRateLimitsService,
  scheduleRateLimitMaintenance,
} from "./rate-limits.service.js";

const HASH_SECRET = "0123456789abcdef0123456789abcdef";
const NOW = new Date("2026-07-28T09:59:00.000Z");

function bucketResult(
  input: RateLimitBucketInput,
  requestCount: number,
  consumed = true,
) {
  return {
    consumed,
    requestCount,
    observedAt: NOW,
    expiresAt: new Date("2026-07-28T10:00:00.000Z"),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createMemoryRepository(): RateLimitsRepository {
  const buckets = new Map<string, number>();

  return {
    async consume(input) {
      const key = `${input.scope}:${input.subjectHash}`;
      const current = buckets.get(key) ?? 0;
      if (current >= input.limit) {
        return bucketResult(input, input.limit, false);
      }
      const next = current + 1;
      buckets.set(key, next);
      return bucketResult(input, next);
    },
    async purgeExpired() {
      return 0;
    },
  };
}

describe("rate limits service", () => {
  it("does not let one normalized subject consume another subject's bucket", async () => {
    const service = createRateLimitsService(createMemoryRepository(), {
      hashSecret: HASH_SECRET,
      now: () => NOW,
    });

    await Promise.all(
      Array.from({ length: 5 }, () =>
        service.consume("booking", "203.0.113.4", 5, 3600),
      ),
    );

    await expect(
      service.consume("booking", "203.0.113.5", 5, 3600),
    ).resolves.toMatchObject({ allowed: true, remaining: 4 });
  });

  it("HMAC-hashes the normalized scope and subject before repository access", async () => {
    let persistedInput: RateLimitBucketInput | undefined;
    const repository: RateLimitsRepository = {
      async consume(input) {
        persistedInput = input;
        return bucketResult(input, 1);
      },
      async purgeExpired() {
        return 0;
      },
    };
    const service = createRateLimitsService(repository, {
      hashSecret: HASH_SECRET,
      now: () => NOW,
    });

    await service.consume("booking", "  203.0.113.4  ", 5, 3600);

    expect(persistedInput?.subjectHash).toBe(
      "231243cc11f5484dd0e35aa214700147545674aae31cc00197716291e743cc8b",
    );
    expect(persistedInput).not.toHaveProperty("subject");
    expect(persistedInput).not.toHaveProperty("hashSecret");
    expect(persistedInput).not.toHaveProperty("now");
  });

  it("uses one bucket for equivalent email casing and Unicode normalization", async () => {
    const persistedHashes: string[] = [];
    const repository: RateLimitsRepository = {
      async consume(input) {
        persistedHashes.push(input.subjectHash);
        return bucketResult(input, 1);
      },
      async purgeExpired() {
        return 0;
      },
    };
    const service = createRateLimitsService(repository, {
      hashSecret: HASH_SECRET,
      now: () => NOW,
    });

    await service.consume(
      "login-ip-email",
      "203.0.113.4\nＡlice@Example.COM",
      5,
      3600,
    );
    await service.consume(
      "login-ip-email",
      "203.0.113.4\nalice@example.com",
      5,
      3600,
    );

    expect(persistedHashes).toHaveLength(2);
    expect(persistedHashes[0]).toBe(persistedHashes[1]);
  });

  it("reports exact remaining, reset, and Retry-After values", async () => {
    const repository: RateLimitsRepository = {
      async consume(input) {
        return bucketResult(input, input.limit, false);
      },
      async purgeExpired() {
        return 0;
      },
    };
    const service = createRateLimitsService(repository, {
      hashSecret: HASH_SECRET,
      now: () => NOW,
    });

    await expect(
      service.consume("booking", "203.0.113.4", 5, 3600),
    ).resolves.toEqual({
      allowed: false,
      limit: 5,
      remaining: 0,
      resetAt: new Date("2026-07-28T10:00:00.000Z"),
      resetAfter: 60,
      retryAfter: 60,
    });
  });

  it.each([undefined, "", "too-short", " ".repeat(64), "a".repeat(64)])(
    "fails closed without a strong hash secret",
    async (hashSecret) => {
      const repository: RateLimitsRepository = {
        consume: vi.fn(),
        purgeExpired: vi.fn(),
      };
      const service = createRateLimitsService(repository, {
        hashSecret,
        now: () => NOW,
      });

      await expect(
        service.consume("booking", "203.0.113.4", 5, 3600),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: "RATE_LIMIT_UNAVAILABLE",
        message: "Please try again shortly.",
      });
      expect(repository.consume).not.toHaveBeenCalled();
    },
  );

  it("fails closed without exposing repository errors", async () => {
    const repository: RateLimitsRepository = {
      async consume() {
        throw new Error(
          "postgres://user:secret@production/customer@example.com",
        );
      },
      async purgeExpired() {
        return 0;
      },
    };
    const service = createRateLimitsService(repository, {
      hashSecret: HASH_SECRET,
      now: () => NOW,
    });

    await expect(
      service.consume("booking", "customer@example.com", 5, 3600),
    ).rejects.toEqual(
      expect.objectContaining({
        statusCode: 503,
        code: "RATE_LIMIT_UNAVAILABLE",
        message: "Please try again shortly.",
      }),
    );
  });

  it("runs daily expiry maintenance through the repository", async () => {
    const purgeExpired = vi.fn(async () => 3);
    const repository: RateLimitsRepository = {
      async consume(input) {
        return bucketResult(input, 1);
      },
      purgeExpired,
    };
    const service = createRateLimitsService(repository, {
      hashSecret: HASH_SECRET,
      now: () => NOW,
    });

    await service.purgeExpired();

    expect(purgeExpired).toHaveBeenCalledWith({
      batchSize: 1_000,
      testReferenceTime: NOW,
    });
  });

  it("does not overlap maintenance and waits for it during shutdown", async () => {
    vi.useFakeTimers();
    const firstPurge = deferred<void>();
    const purgeExpired = vi.fn(() => firstPurge.promise);
    const service = {
      consume: vi.fn(),
      purgeExpired,
    } as unknown as ReturnType<typeof createRateLimitsService>;

    try {
      const stop = scheduleRateLimitMaintenance(service, {
        intervalMs: 1_000,
      });
      await vi.advanceTimersByTimeAsync(3_000);
      expect(purgeExpired).toHaveBeenCalledTimes(1);

      let stopped = false;
      const stopping = stop().then(() => {
        stopped = true;
      });
      await Promise.resolve();
      expect(stopped).toBe(false);

      firstPurge.resolve();
      await stopping;
      expect(stopped).toBe(true);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(purgeExpired).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports maintenance failure without exposing the repository error", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const service = {
      consume: vi.fn(),
      async purgeExpired() {
        throw new Error("customer@example.com secret database details");
      },
    } as unknown as ReturnType<typeof createRateLimitsService>;

    try {
      const stop = scheduleRateLimitMaintenance(service, {
        intervalMs: 1_000,
        onError,
      });
      await vi.advanceTimersByTimeAsync(1_000);
      expect(onError).toHaveBeenCalledWith();
      await stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not latch maintenance when the error reporter throws", async () => {
    vi.useFakeTimers();
    const purgeExpired = vi.fn(async () => {
      throw new Error("database unavailable");
    });
    const service = {
      consume: vi.fn(),
      purgeExpired,
    } as unknown as ReturnType<typeof createRateLimitsService>;

    try {
      const stop = scheduleRateLimitMaintenance(service, {
        intervalMs: 1_000,
        onError() {
          throw new Error("logger unavailable");
        },
      });
      await vi.advanceTimersByTimeAsync(2_000);
      expect(purgeExpired).toHaveBeenCalledTimes(2);
      await expect(stop()).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
