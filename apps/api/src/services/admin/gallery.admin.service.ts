import type { Db } from "@yezz/db";
import { AppError } from "../../lib/errors.js";
import {
  createGalleryRepository,
  type GalleryImageCreateInput,
  type GalleryImageUpdateInput,
} from "../../repositories/gallery.repository.js";
import { mapGalleryRow, type GalleryImageDto } from "../gallery.service.js";

const GALLERY_CATEGORIES = new Set([
  "couple",
  "birthday",
  "kids",
  "gift",
  "store",
  "works",
]);

export type AdminGalleryService = ReturnType<typeof createAdminGalleryService>;

export function createAdminGalleryService(db: Db) {
  const repo = createGalleryRepository(db);

  function validateCategory(category: string) {
    if (!GALLERY_CATEGORIES.has(category)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `category must be one of: ${[...GALLERY_CATEGORIES].join(", ")}`,
      );
    }
  }

  function validateCreate(input: GalleryImageCreateInput) {
    if (!input.imageUrl?.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "imageUrl is required");
    }
    validateCategory(input.category);
  }

  return {
    async list(): Promise<GalleryImageDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map(mapGalleryRow);
    },

    async getById(id: string): Promise<GalleryImageDto> {
      const row = await repo.findById(id);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Gallery image not found");
      }
      return mapGalleryRow(row);
    },

    async create(input: GalleryImageCreateInput): Promise<GalleryImageDto> {
      validateCreate(input);
      const row = await repo.create(input);
      return mapGalleryRow(row);
    },

    async update(id: string, input: GalleryImageUpdateInput): Promise<GalleryImageDto> {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Gallery image not found");
      }
      if (input.category) {
        validateCategory(input.category);
      }
      const row = await repo.update(id, input);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Gallery image not found");
      }
      return mapGalleryRow(row);
    },

    async delete(id: string): Promise<{ id: string }> {
      const row = await repo.delete(id);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Gallery image not found");
      }
      return { id: row.id };
    },
  };
}
