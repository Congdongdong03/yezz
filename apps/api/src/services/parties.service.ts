import type { partyPackages } from "@yezz/db";
import type { Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import { createPartiesRepository } from "../repositories/parties.repository.js";

export type PartyDto = {
  id: string;
  name: { en: string; zh: string };
  slug: string;
  description: { en: string; zh: string } | null;
  includes: { en: string; zh: string }[];
  imageUrl: string | null;
  imageUrls: string[];
  minPeople: number;
  maxPeople: number;
  priceIndicator: string | null;
  tags: string[] | null;
  sortOrder: number;
};

type PartyRow = typeof partyPackages.$inferSelect;

export function mapPartyRow(row: PartyRow): PartyDto {
  const urls = row.imageUrls ?? [];
  const cover = row.coverImageUrl ?? urls[0] ?? null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    includes: row.includes ?? [],
    imageUrl: cover,
    imageUrls: urls,
    minPeople: row.minPeople,
    maxPeople: row.maxPeople,
    priceIndicator: row.priceIndicator ?? null,
    tags: row.tags ?? null,
    sortOrder: row.sortOrder,
  };
}

export type PartiesService = ReturnType<typeof createPartiesService>;

export function createPartiesService(db: Db) {
  const repo = createPartiesRepository(db);

  return {
    async list(): Promise<PartyDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map(mapPartyRow);
    },

    async getBySlug(slug: string): Promise<PartyDto> {
      const row = await repo.findBySlug(slug);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", `Party package not found: ${slug}`);
      }
      return mapPartyRow(row);
    },
  };
}
