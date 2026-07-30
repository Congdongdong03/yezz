import { describe, expect, it } from "vitest";
import { cacheGet, cacheSet, invalidateProjectsCache } from "./cache.js";

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

  it("invalidates project and catalogue cache keys after an operational project changes", async () => {
    const redis = new FakeRedis() as never;
    await cacheSet(redis, "cache:projects:list", []);
    await cacheSet(redis, "cache:projects:slug:foo", {});
    await cacheSet(redis, "catalogue:list", []);
    await cacheSet(redis, "catalogue:slug:foo", {});
    await cacheSet(redis, "cache:settings", {});

    await invalidateProjectsCache(redis);

    expect(await cacheGet(redis, "cache:projects:list")).toBeNull();
    expect(await cacheGet(redis, "cache:projects:slug:foo")).toBeNull();
    expect(await cacheGet(redis, "catalogue:list")).toBeNull();
    expect(await cacheGet(redis, "catalogue:slug:foo")).toBeNull();
    expect(await cacheGet(redis, "cache:settings")).toEqual({});
  });
});
