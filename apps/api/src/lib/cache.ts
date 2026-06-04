import type Redis from "ioredis";

export const CACHE_TTL_SECONDS = 300;

/** In-memory fallback rate-limiter used when Redis is unavailable. */
const inMemoryCounters = new Map<string, { count: number; expiresAt: number }>();

function inMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = inMemoryCounters.get(key);

  if (!entry || entry.expiresAt <= now) {
    inMemoryCounters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.expiresAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

export const CACHE_KEYS = {
  projectsList: "cache:projects:list",
  projectSlug: (slug: string) => `cache:projects:slug:${slug}`,
  settings: "cache:settings",
} as const;

export async function cacheGet<T>(redis: Redis | null, key: string): Promise<T | null> {
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

export async function cacheDel(redis: Redis | null, ...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // ignore
  }
}

export async function invalidateProjectsCache(redis: Redis | null): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys("cache:projects:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // ignore
  }
}

export async function checkRateLimit(
  redis: Redis | null,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (!redis) {
    return inMemoryRateLimit(key, limit, windowSeconds);
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (count > limit) {
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : windowSeconds };
    }
    return { allowed: true };
  } catch {
    return inMemoryRateLimit(key, limit, windowSeconds);
  }
}
