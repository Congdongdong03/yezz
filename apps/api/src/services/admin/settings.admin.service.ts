import type { Db } from "@yezz/db";
import type Redis from "ioredis";
import { AppError } from "../../lib/errors.js";
import { CACHE_KEYS, cacheDel } from "../../lib/cache.js";
import {
  createSettingsRepository,
  type SiteSettingsUpdateInput,
} from "../../repositories/settings.repository.js";
import {
  readRequestCapabilities,
  type SiteSettingsDto,
} from "../settings.service.js";

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
    requestCapabilities: readRequestCapabilities(),
  };
}

export type AdminSettingsService = ReturnType<typeof createAdminSettingsService>;

export const DEFAULT_YEZYY_SITE_SETTINGS = {
  storeName: "YezYY",
  address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
  businessHours:
    "Monday 9:30 am–5:00 pm; Tuesday 9:30 am–5:00 pm; Wednesday 9:30 am–5:00 pm; Thursday 9:30 am–8:30 pm; Friday 9:30 am–8:30 pm; Saturday 9:30 am–5:30 pm; Sunday 10:00 am–5:00 pm",
  phone: "0430 787 712",
  email: "congdongdong03@gmail.com",
  wechatId: null,
  xiaohongshu: "95848743904",
  googleMapUrl:
    "https://www.google.com/maps/search/?api=1&query=G082%2F235%20Springvale%20Rd%2C%20Glen%20Waverley%20VIC%203150",
} as const;

export function createAdminSettingsService(db: Db, redis: Redis | null = null) {
  const repo = createSettingsRepository(db);

  return {
    async get(): Promise<SiteSettingsDto> {
      let row = await repo.findSingleton();
      if (!row) {
        row = await repo.upsertSingleton(DEFAULT_YEZYY_SITE_SETTINGS);
        if (!row) {
          throw new AppError(500, "INTERNAL_ERROR", "Failed to initialize site settings");
        }
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
