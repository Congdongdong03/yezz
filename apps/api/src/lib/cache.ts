import type Redis from "ioredis";

export const CACHE_TTL_SECONDS = 300;

export const CACHE_KEYS = {
  catalogueList: "catalogue:list",
  catalogueSlug: (slug: string) => `catalogue:slug:${slug}`,
  projectsList: "cache:projects:list",
  projectSlug: (slug: string) => `cache:projects:slug:${slug}`,
  settings: "cache:settings",
} as const;

export async function cacheGet<T>(
  redis: Redis | null,
  key: string,
): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  redis: Redis | null,
  key: string,
  value: unknown,
  ttlSeconds = CACHE_TTL_SECONDS,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // cache miss on write failure
  }
}

export async function cacheDel(
  redis: Redis | null,
  ...keys: string[]
): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // ignore
  }
}

async function invalidateCachePattern(
  redis: Redis | null,
  pattern: string,
): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // ignore
  }
}

export async function invalidateProjectsCache(
  redis: Redis | null,
): Promise<void> {
  await Promise.all([
    invalidateCachePattern(redis, "cache:projects:*"),
    invalidateCatalogueCache(redis),
  ]);
}

export async function invalidateCatalogueCache(
  redis: Redis | null,
): Promise<void> {
  await invalidateCachePattern(redis, "catalogue:*");
}
