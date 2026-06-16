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

    async upsertSingleton(data: SiteSettingsUpdateInput) {
      const existing = await this.findSingleton();
      if (existing) {
        const [row] = await db
          .update(siteSettings)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(siteSettings.id, existing.id))
          .returning();
        return row ?? null;
      }
      const [row] = await db
        .insert(siteSettings)
        .values({
          storeName: data.storeName ?? "",
          address: data.address ?? null,
          businessHours: data.businessHours ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          wechatId: data.wechatId ?? null,
          wechatQrUrl: data.wechatQrUrl ?? null,
          heroImageUrl: data.heroImageUrl ?? null,
          instagram: data.instagram ?? null,
          xiaohongshu: data.xiaohongshu ?? null,
          googleMapUrl: data.googleMapUrl ?? null,
          seoTitle: data.seoTitle ?? null,
          seoDescription: data.seoDescription ?? null,
          updatedAt: new Date(),
        })
        .returning();
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
