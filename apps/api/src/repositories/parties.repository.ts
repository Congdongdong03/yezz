import {
  partyPackages,
  type Db,
  type LocalizedString,
} from "@yezz/db";
import { asc, count, eq } from "drizzle-orm";

export type PartyCreateInput = {
  name: LocalizedString;
  slug: string;
  description?: LocalizedString | null;
  includes?: LocalizedString[];
  coverImageUrl?: string | null;
  imageUrls?: string[];
  minPeople?: number;
  maxPeople?: number;
  priceIndicator?: string | null;
  tags?: string[] | null;
  sortOrder?: number;
};

export type PartyUpdateInput = Partial<PartyCreateInput>;

export function createPartiesRepository(db: Db) {
  return {
    findAllOrdered() {
      return db.select().from(partyPackages).orderBy(asc(partyPackages.sortOrder));
    },

    async countAll() {
      const [row] = await db.select({ value: count() }).from(partyPackages);
      return Number(row?.value ?? 0);
    },

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(partyPackages)
        .where(eq(partyPackages.id, id))
        .limit(1);
      return row ?? null;
    },

    async findBySlug(slug: string) {
      const [row] = await db
        .select()
        .from(partyPackages)
        .where(eq(partyPackages.slug, slug))
        .limit(1);
      return row ?? null;
    },

    async create(input: PartyCreateInput) {
      const [row] = await db
        .insert(partyPackages)
        .values({
          name: input.name,
          slug: input.slug.trim(),
          description: input.description ?? null,
          includes: input.includes ?? [],
          coverImageUrl: input.coverImageUrl ?? null,
          imageUrls: input.imageUrls ?? [],
          minPeople: input.minPeople ?? 2,
          maxPeople: input.maxPeople ?? 20,
          priceIndicator: input.priceIndicator ?? null,
          tags: input.tags ?? null,
          sortOrder: input.sortOrder ?? 0,
          updatedAt: new Date(),
        })
        .returning();
      return row;
    },

    async update(id: string, input: PartyUpdateInput) {
      const [row] = await db
        .update(partyPackages)
        .set({
          ...input,
          slug: input.slug?.trim(),
          updatedAt: new Date(),
        })
        .where(eq(partyPackages.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id: string) {
      const [row] = await db
        .delete(partyPackages)
        .where(eq(partyPackages.id, id))
        .returning({ id: partyPackages.id });
      return row ?? null;
    },
  };
}
