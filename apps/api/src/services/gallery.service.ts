import type { galleryImages } from "@yezz/db";
import type { Db } from "@yezz/db";
import { createGalleryRepository } from "../repositories/gallery.repository.js";

export type GalleryImageDto = {
  id: string;
  imageUrl: string;
  category: string;
  caption: { en: string; zh: string } | null;
  sortOrder: number;
};

type GalleryRow = typeof galleryImages.$inferSelect;

export function mapGalleryRow(row: GalleryRow): GalleryImageDto {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    category: row.category,
    caption: row.caption ?? null,
    sortOrder: row.sortOrder,
  };
}

export type GalleryService = ReturnType<typeof createGalleryService>;

export function createGalleryService(db: Db) {
  const repo = createGalleryRepository(db);

  return {
    async list(): Promise<GalleryImageDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map(mapGalleryRow);
    },

    async listHighlight(limit = 6): Promise<GalleryImageDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.slice(0, limit).map(mapGalleryRow);
    },

    async findStoreVibes(): Promise<GalleryImageDto | null> {
      const rows = await repo.findByCategory("store");
      const first = rows[0];
      return first ? mapGalleryRow(first) : null;
    },
  };
}
