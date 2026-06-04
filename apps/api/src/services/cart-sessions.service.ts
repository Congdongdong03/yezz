import type { CartSessionItem, Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import { createCartSessionsRepository } from "../repositories/cart-sessions.repository.js";

export type CartSessionsService = ReturnType<typeof createCartSessionsService>;

export function createCartSessionsService(db: Db) {
  const repo = createCartSessionsRepository(db);

  return {
    async get(sessionId: string) {
      const row = await repo.findById(sessionId);
      if (!row) {
        return { id: sessionId, items: [] as CartSessionItem[] };
      }
      if (row.expiresAt < new Date()) {
        return { id: sessionId, items: [] as CartSessionItem[] };
      }
      return { id: row.id, items: row.items ?? [] };
    },

    async save(sessionId: string, items: CartSessionItem[]) {
      if (!sessionId?.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "session id is required");
      }
      for (const item of items) {
        if (!item.projectId || !item.projectSlug || !item.projectName) {
          throw new AppError(400, "VALIDATION_ERROR", "invalid cart item");
        }
      }
      const row = await repo.upsert(sessionId, items);
      return { id: row.id, items: row.items ?? [] };
    },

    async purgeExpired() {
      await repo.deleteExpired();
    },
  };
}
