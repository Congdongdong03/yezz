import type { CartOrderItemSnapshot, Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import {
  displayLocalized,
  escapeHtml,
  formatCartOrderId,
  sendOrderConfirmationToCustomer,
  sendOwnerEmail,
  type StoreContact,
} from "../lib/email.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
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
  if (input.email?.trim()) {
    const email = input.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError(400, "VALIDATION_ERROR", "email is invalid");
    }
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
    <p><strong>Email:</strong> ${escapeHtml(input.email?.trim() || "N/A")}</p>
    <p><strong>Note:</strong> ${escapeHtml(input.message?.trim() || "N/A")}</p>
    <h3>Items:</h3>
    ${itemsHtml}
  `;
}

async function loadStoreContact(db: Db): Promise<StoreContact> {
  const settingsRepo = createSettingsRepository(db);
  const row = await settingsRepo.findSingleton();
  if (!row) return {};
  return {
    phone: row.phone,
    wechatId: row.wechatId,
    email: row.email,
  };
}

export function createCartOrdersService(db: Db) {
  const repo = createCartOrdersRepository(db);

  return {
    async create(input: CartOrderCreateInput): Promise<CartOrderDto> {
      validateCartOrderInput(input);

      const row = await repo.create(input);
      const orderNumber = formatCartOrderId(row.id, row.createdAt);
      const contact = await loadStoreContact(db);

      try {
        await sendOwnerEmail(
          `New Order from ${input.name.trim()} (${orderNumber})`,
          buildCartOrderEmailHtml(input),
        );
      } catch (error) {
        console.error("Cart order owner email failed:", error);
      }

      const customerEmail = input.email?.trim();
      if (customerEmail) {
        try {
          await sendOrderConfirmationToCustomer({
            to: customerEmail,
            orderNumber,
            submittedAt: row.createdAt,
            input,
            contact,
          });
        } catch (error) {
          console.error("Cart order customer confirmation email failed:", error);
        }
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
