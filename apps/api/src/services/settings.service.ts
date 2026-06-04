import type { Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
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
};

export type SettingsService = ReturnType<typeof createSettingsService>;

export function createSettingsService(db: Db) {
  const repo = createSettingsRepository(db);

  return {
    async get(): Promise<SiteSettingsDto> {
      const row = await repo.findSingleton();
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Site settings not configured");
      }

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
    },
  };
}
