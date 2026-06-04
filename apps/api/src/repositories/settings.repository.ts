import { siteSettings, type Db } from "@yezz/db";
import { eq } from "drizzle-orm";

export type SiteSettingsUpdateInput = Partial<{
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
}>;

export function createSettingsRepository(db: Db) {
  return {
    async findSingleton() {
      const [row] = await db.select().from(siteSettings).limit(1);
      return row ?? null;
    },

    async updateSingleton(data: SiteSettingsUpdateInput) {
      const existing = await this.findSingleton();
      if (!existing) return null;

      const [row] = await db
        .update(siteSettings)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(siteSettings.id, existing.id))
        .returning();
      return row ?? null;
    },
  };
}
