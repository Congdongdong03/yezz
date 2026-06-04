import type { Db } from "@yezz/db";
import { AppError } from "../../lib/errors.js";
import {
  createPartiesRepository,
  type PartyCreateInput,
  type PartyUpdateInput,
} from "../../repositories/parties.repository.js";
import { mapPartyRow, type PartyDto } from "../parties.service.js";

export type AdminPartiesService = ReturnType<typeof createAdminPartiesService>;

export function createAdminPartiesService(db: Db) {
  const repo = createPartiesRepository(db);

  function validateCreate(input: PartyCreateInput) {
    if (!input.slug?.trim() || !input.name?.en || !input.name?.zh) {
      throw new AppError(400, "VALIDATION_ERROR", "slug and name (en/zh) are required");
    }
  }

  async function assertSlugAvailable(slug: string, excludeId?: string) {
    const existing = await repo.findBySlug(slug);
    if (existing && existing.id !== excludeId) {
      throw new AppError(409, "CONFLICT", `Slug already exists: ${slug}`);
    }
  }

  return {
    async list(): Promise<PartyDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map(mapPartyRow);
    },

    async getById(id: string): Promise<PartyDto> {
      const row = await repo.findById(id);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Party package not found");
      }
      return mapPartyRow(row);
    },

    async create(input: PartyCreateInput): Promise<PartyDto> {
      validateCreate(input);
      await assertSlugAvailable(input.slug);
      const row = await repo.create(input);
      return mapPartyRow(row);
    },

    async update(id: string, input: PartyUpdateInput): Promise<PartyDto> {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Party package not found");
      }
      if (input.slug) {
        await assertSlugAvailable(input.slug, id);
      }
      const row = await repo.update(id, input);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Party package not found");
      }
      return mapPartyRow(row);
    },

    async delete(id: string): Promise<{ id: string }> {
      const row = await repo.delete(id);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Party package not found");
      }
      return { id: row.id };
    },
  };
}
