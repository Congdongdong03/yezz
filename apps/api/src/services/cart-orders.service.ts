import type { CartOrderItemSnapshot, Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import { displayLocalized, escapeHtml, sendOwnerEmail } from "../lib/email.js";
import {
  createCartOrdersRepository,
  type CartOrderCreateInput,
} from "../repositories/cart-orders.repository.js";

export type CartOrderDto = {
  id: string;
  status: string;
  createdAt: Date;
};

export type CartOrdersService = ReturnType<typeof createCartOrdersService>;

function validateCartOrderInput(input: CartOrderCreateInput) {
  if (!input.name?.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", "name is required");
  }
  if (!input.phone?.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", "phone is required");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "items must be a non-empty array");
  }

  for (const item of input.items) {
    if (item.projectType && !["experience", "product"].includes(item.projectType)) {
      throw new AppError(400, "VALIDATION_ERROR", "item projectType must be experience or product");
    }
    if (item.people != null && item.people < 1) {
      throw new AppError(400, "VALIDATION_ERROR", "item people must be at least 1");
    }
  }
}

function buildCartOrderEmailHtml(input: CartOrderCreateInput): string {
  const itemsHtml = input.items
    .map((item, index) => {
      const name = escapeHtml(displayLocalized(item.projectName));
      const style = item.styleName ? escapeHtml(displayLocalized(item.styleName)) : null;
      const detail = style
        ? style
        : escapeHtml(`${item.date || ""} / ${item.people ?? 0} people`);
      const price = escapeHtml(item.price || "N/A");
      return `<p>${index + 1}. ${name} — ${detail} — ${price}</p>`;
    })
    .join("");

  return `
    <h2>New Order Received</h2>
    <p><strong>Name:</strong> ${escapeHtml(input.name.trim())}</p>
    <p><strong>Phone:</strong> ${escapeHtml(input.phone.trim())}</p>
    <p><strong>WeChat:</strong> ${escapeHtml(input.wechat?.trim() || "N/A")}</p>
    <p><strong>Note:</strong> ${escapeHtml(input.message?.trim() || "N/A")}</p>
    <h3>Items:</h3>
    ${itemsHtml}
  `;
}

export function createCartOrdersService(db: Db) {
  const repo = createCartOrdersRepository(db);

  return {
    async create(input: CartOrderCreateInput): Promise<CartOrderDto> {
      validateCartOrderInput(input);

      const row = await repo.create(input);

      try {
        await sendOwnerEmail(
          `New Order from ${input.name.trim()}`,
          buildCartOrderEmailHtml(input),
        );
      } catch (error) {
        console.error("Cart order email notification failed:", error);
      }

      return {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
      };
    },
  };
}

export type { CartOrderItemSnapshot };
