import { siteSettings, type Db } from "@yezz/db";
import { desc, eq } from "drizzle-orm";

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
    async findSingleton(options?: { lock?: "share" | "update" }) {
      const query = db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.singletonKey, true))
        .orderBy(
          desc(siteSettings.updatedAt),
          desc(siteSettings.createdAt),
          desc(siteSettings.id),
        )
        .limit(1);
      const [row] = options?.lock
        ? await query.for(options.lock)
        : await query;
      return row ?? null;
    },

    async upsertSingleton(data: SiteSettingsUpdateInput) {
      const [row] = await db
        .insert(siteSettings)
        .values({
          singletonKey: true,
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
        .onConflictDoUpdate({
          target: siteSettings.singletonKey,
          set: {
            ...data,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row ?? null;
    },

    async updateSingleton(data: SiteSettingsUpdateInput) {
      const [row] = await db
        .update(siteSettings)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(siteSettings.singletonKey, true))
        .returning();
      return row ?? null;
    },
  };
}
