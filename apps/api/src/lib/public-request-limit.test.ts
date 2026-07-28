import { describe, expect, it } from "vitest";
import { enforcePublicRequestLimit } from "./public-request-limit.js";

type RateLimitEntry = { count: number; expiresAt: number };

function createInMemoryRateLimitRedis() {
  const entries = new Map<string, RateLimitEntry>();

  return {
    async incr(key: string) {
      const entry = entries.get(key);
      const count = (entry?.count ?? 0) + 1;
      entries.set(key, { count, expiresAt: entry?.expiresAt ?? 0 });
      return count;
    },
    async expire(key: string, seconds: number) {
      const entry = entries.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    },
    async ttl(key: string) {
      const entry = entries.get(key);
      if (!entry?.expiresAt) return -1;
      return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    },
  };
}

describe("enforcePublicRequestLimit", () => {
  it("rejects the sixth request within one hour and sets Retry-After", async () => {
    const redis = createInMemoryRateLimitRedis() as never;
    const headers: Record<string, string> = {};
    const reply = {
      header(name: string, value: string) {
        headers[name] = value;
        return this;
      },
    } as never;

    for (let i = 0; i < 5; i += 1) {
      await enforcePublicRequestLimit(redis, "ratelimit:cart-orders:203.0.113.10", reply);
    }

    await expect(
      enforcePublicRequestLimit(redis, "ratelimit:cart-orders:203.0.113.10", reply),
    ).rejects.toMatchObject({ statusCode: 429, code: "RATE_LIMITED" });
    expect(headers["Retry-After"]).toMatch(/^[1-9][0-9]*$/);
  });
});
