import {
  galleryImages,
  type Db,
  type LocalizedString,
} from "@yezz/db";
import { asc, count, eq } from "drizzle-orm";

export type GalleryImageCreateInput = {
  imageUrl: string;
  category: string;
  caption?: LocalizedString | null;
  sortOrder?: number;
};

export type GalleryImageUpdateInput = Partial<GalleryImageCreateInput>;

export function createGalleryRepository(db: Db) {
  return {
    findAllOrdered() {
      return db.select().from(galleryImages).orderBy(asc(galleryImages.sortOrder));
    },

    findByCategory(category: string) {
      return db
        .select()
        .from(galleryImages)
        .where(eq(galleryImages.category, category))
        .orderBy(asc(galleryImages.sortOrder));
    },

    async countAll() {
      const [row] = await db.select({ value: count() }).from(galleryImages);
      return Number(row?.value ?? 0);
    },

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(galleryImages)
        .where(eq(galleryImages.id, id))
        .limit(1);
      return row ?? null;
    },

    async create(input: GalleryImageCreateInput) {
      const [row] = await db
        .insert(galleryImages)
        .values({
          imageUrl: input.imageUrl,
          category: input.category,
          caption: input.caption ?? null,
          sortOrder: input.sortOrder ?? 0,
          updatedAt: new Date(),
        })
        .returning();
      return row;
    },

    async update(id: string, input: GalleryImageUpdateInput) {
      const [row] = await db
        .update(galleryImages)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(galleryImages.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id: string) {
      const [row] = await db
        .delete(galleryImages)
        .where(eq(galleryImages.id, id))
        .returning({ id: galleryImages.id });
      return row ?? null;
    },
  };
}
