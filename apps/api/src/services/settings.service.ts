import type { Db } from "@yezz/db";
import type Redis from "ioredis";
import { AppError } from "../lib/errors.js";
import { CACHE_KEYS, cacheDel, cacheGet, cacheSet } from "../lib/cache.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";

export type SiteSettingsDto = {
  id: string;
  storeName: string;
  address: string | null;
  businessHours: string | null;
  phone: string | null;
  email: string | null;
  wechatId: string | null;
  wechatQrUrl: string | null;
  heroImageUrl: string | null;
  instagram: string | null;
  xiaohongshu: string | null;
  googleMapUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  requestCapabilities: RequestCapabilities;
};

export type RequestCapabilities = {
  experience: boolean;
  product: boolean;
  party: boolean;
};

export type SettingsService = ReturnType<typeof createSettingsService>;

type RequestCapabilityEnvironment = Partial<
  Record<
    | "REQUEST_FLOW_EXPERIENCE_ENABLED"
    | "REQUEST_FLOW_PRODUCT_ENABLED"
    | "REQUEST_FLOW_PARTY_ENABLED",
    string | undefined
  >
>;

/**
 * Request flows fail closed. Only the exact value `true` enables a flow so
 * copied placeholders, casing mistakes, and numeric truthy values stay safe.
 */
export function readRequestCapabilities(
  env: RequestCapabilityEnvironment = process.env,
): RequestCapabilities {
  return {
    experience: env.REQUEST_FLOW_EXPERIENCE_ENABLED === "true",
    product: env.REQUEST_FLOW_PRODUCT_ENABLED === "true",
    party: env.REQUEST_FLOW_PARTY_ENABLED === "true",
  };
}

/**
 * Public create routes call this before durable rate limiting. Unknown request
 * kinds and missing or malformed flags all fail closed without touching a
 * database-backed service.
 */
export function requireRequestCapability(
  capability: string,
  env: RequestCapabilityEnvironment = process.env,
): void {
  const capabilities = readRequestCapabilities(env);
  if (
    !["experience", "product", "party"].includes(capability) ||
    !capabilities[capability as keyof RequestCapabilities]
  ) {
    throw new AppError(
      503,
      "REQUEST_FLOW_DISABLED",
      `${capability} requests are not currently available`,
    );
  }
}

export function createSettingsService(
  db: Db,
  redis: Redis | null = null,
  env: RequestCapabilityEnvironment = process.env,
) {
  const repo = createSettingsRepository(db);

  return {
    async get(): Promise<SiteSettingsDto> {
      const cached = await cacheGet<SiteSettingsDto>(redis, CACHE_KEYS.settings);
      if (cached) {
        return {
          ...cached,
          requestCapabilities: readRequestCapabilities(env),
        };
      }

      const row = await repo.findSingleton();
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Site settings not configured");
      }

      const result: SiteSettingsDto = {
        id: row.id,
        storeName: row.storeName,
        address: row.address ?? null,
        businessHours: row.businessHours ?? null,
        phone: row.phone ?? null,
        email: row.email ?? null,
        wechatId: row.wechatId ?? null,
        wechatQrUrl: row.wechatQrUrl ?? null,
        heroImageUrl: row.heroImageUrl ?? null,
        instagram: row.instagram ?? null,
        xiaohongshu: row.xiaohongshu ?? null,
        googleMapUrl: row.googleMapUrl ?? null,
        seoTitle: row.seoTitle ?? null,
        seoDescription: row.seoDescription ?? null,
        requestCapabilities: readRequestCapabilities(env),
      };
      await cacheSet(redis, CACHE_KEYS.settings, result);
      return result;
    },
  };
}
