import type { Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import {
  escapeHtml,
  formatBookingOrderId,
  sendBookingConfirmationToCustomer,
  sendOwnerEmail,
  type StoreContact,
} from "../lib/email.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import {
  createBookingsRepository,
  type BookingCreateInput,
} from "../repositories/bookings.repository.js";

export type BookingDto = {
  id: string;
  status: string;
  createdAt: Date;
};

export type BookingsService = ReturnType<typeof createBookingsService>;

function validateBookingInput(input: BookingCreateInput) {
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
  if (input.numberOfPeople != null && input.numberOfPeople < 1) {
    throw new AppError(400, "VALIDATION_ERROR", "numberOfPeople must be at least 1");
  }
}

function buildBookingEmailHtml(input: BookingCreateInput): string {
  return `
    <h2>New Booking Received</h2>
    <p><strong>Name:</strong> ${escapeHtml(input.name.trim())}</p>
    <p><strong>Phone:</strong> ${escapeHtml(input.phone.trim())}</p>
    <p><strong>WeChat:</strong> ${escapeHtml(input.wechat?.trim() || "N/A")}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email?.trim() || "N/A")}</p>
    <p><strong>Date:</strong> ${escapeHtml(input.preferredDate?.trim() || "N/A")}</p>
    <p><strong>People:</strong> ${input.numberOfPeople ?? "N/A"}</p>
    <p><strong>Type:</strong> ${escapeHtml(input.activityType?.trim() || "N/A")}</p>
    <p><strong>Project:</strong> ${escapeHtml(input.interestedProject?.trim() || "N/A")}</p>
    <p><strong>Message:</strong> ${escapeHtml(input.message?.trim() || "N/A")}</p>
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

export function createBookingsService(db: Db) {
  const repo = createBookingsRepository(db);

  return {
    async create(input: BookingCreateInput): Promise<BookingDto> {
      validateBookingInput(input);

      const row = await repo.create(input);
      const orderNumber = formatBookingOrderId(row.id, row.createdAt);
      const contact = await loadStoreContact(db);

      try {
        await sendOwnerEmail(
          `New Booking from ${input.name.trim()} (${orderNumber})`,
          buildBookingEmailHtml(input),
        );
      } catch (error) {
        console.error("Booking owner email failed:", error);
      }

      const customerEmail = input.email?.trim();
      if (customerEmail) {
        try {
          await sendBookingConfirmationToCustomer({
            to: customerEmail,
            orderId: row.id,
            orderNumber,
            submittedAt: row.createdAt,
            input,
            contact,
          });
        } catch (error) {
          console.error("Booking customer confirmation email failed:", error);
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
