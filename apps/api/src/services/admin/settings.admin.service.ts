import type { Db } from "@yezz/db";
import type Redis from "ioredis";
import { AppError } from "../../lib/errors.js";
import { CACHE_KEYS, cacheDel } from "../../lib/cache.js";
import {
  createSettingsRepository,
  type SiteSettingsUpdateInput,
} from "../../repositories/settings.repository.js";
import type { SiteSettingsDto } from "../settings.service.js";

function toSettingsDto(row: NonNullable<Awaited<ReturnType<ReturnType<typeof createSettingsRepository>["findSingleton"]>>>): SiteSettingsDto {
  return {
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
  };
}

export type AdminSettingsService = ReturnType<typeof createAdminSettingsService>;

export function createAdminSettingsService(db: Db, redis: Redis | null = null) {
  const repo = createSettingsRepository(db);

  return {
    async get(): Promise<SiteSettingsDto> {
      const row = await repo.findSingleton();
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Site settings not configured");
      }
      return toSettingsDto(row);
    },

    async update(input: SiteSettingsUpdateInput): Promise<SiteSettingsDto> {
      const updated = await repo.updateSingleton(input);
      if (!updated) {
        throw new AppError(404, "NOT_FOUND", "Site settings not configured");
      }
      await cacheDel(redis, CACHE_KEYS.settings);
      return toSettingsDto(updated);
    },
  };
}
