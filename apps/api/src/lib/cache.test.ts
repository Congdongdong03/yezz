import { describe, expect, it } from "vitest";
import { checkRateLimit, cacheGet, cacheSet, invalidateProjectsCache } from "./cache.js";

type FakeRedisStore = Map<string, { value: string; expireAt?: number }>;

class FakeRedis {
  private store: FakeRedisStore = new Map();

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expireAt && entry.expireAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, _ex: "EX", ttl: number) {
    this.store.set(key, { value, expireAt: Date.now() + ttl * 1000 });
    return "OK";
  }

  async incr(key: string) {
    const current = Number((await this.get(key)) ?? 0) + 1;
    const entry = this.store.get(key);
    this.store.set(key, {
      value: String(current),
      expireAt: entry?.expireAt,
    });
    return current;
  }

  async expire(key: string, ttl: number) {
    const entry = this.store.get(key);
    if (entry) {
      entry.expireAt = Date.now() + ttl * 1000;
      return 1;
    }
    return 0;
  }

  async ttl(key: string) {
    const entry = this.store.get(key);
    if (!entry?.expireAt) return -1;
    return Math.max(1, Math.ceil((entry.expireAt - Date.now()) / 1000));
  }

  async del(...keys: string[]) {
    keys.forEach((k) => this.store.delete(k));
    return keys.length;
  }

  async keys(pattern: string) {
    const prefix = pattern.replace("*", "");
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }
}

describe("cache", () => {
  it("stores and reads JSON values", async () => {
    const redis = new FakeRedis() as never;
    await cacheSet(redis, "test:key", { ok: true });
    const value = await cacheGet<{ ok: boolean }>(redis, "test:key");
    expect(value).toEqual({ ok: true });
  });

  it("allows requests within rate limit", async () => {
    const redis = new FakeRedis() as never;
    const key = "ratelimit:test";
    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimit(redis, key, 3, 60);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests over rate limit", async () => {
    const redis = new FakeRedis() as never;
    const key = "ratelimit:block";
    await checkRateLimit(redis, key, 2, 60);
    await checkRateLimit(redis, key, 2, 60);
    const blocked = await checkRateLimit(redis, key, 2, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("invalidates project cache keys", async () => {
    const redis = new FakeRedis() as never;
    await cacheSet(redis, "cache:projects:list", []);
    await cacheSet(redis, "cache:projects:slug:foo", {});
    await invalidateProjectsCache(redis);
    expect(await cacheGet(redis, "cache:projects:list")).toBeNull();
    expect(await cacheGet(redis, "cache:projects:slug:foo")).toBeNull();
  });

  it("degrades when redis is null", async () => {
    const result = await checkRateLimit(null, "any", 1, 60);
    expect(result.allowed).toBe(true);
  });
});
