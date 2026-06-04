import { bookings, type Db } from "@yezz/db";
import { AppError } from "../../lib/errors.js";
import {
  formatBookingOrderId,
  sendBookingStatusCancelledEmail,
  sendBookingStatusConfirmedEmail,
  sendBookingStatusContactedEmail,
  type StoreContact,
} from "../../lib/email.js";
import {
  createBookingsRepository,
  type OrderStatus,
} from "../../repositories/bookings.repository.js";
import { createSettingsRepository } from "../../repositories/settings.repository.js";
import { createTimeSlotsRepository } from "../../repositories/time-slots.repository.js";

export type BookingDto = {
  id: string;
  name: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  preferredDate: string | null;
  numberOfPeople: number | null;
  activityType: string | null;
  interestedProject: string | null;
  message: string | null;
  locale: string | null;
  timeSlotId: string | null;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
};

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "contacted",
  "confirmed",
  "cancelled",
];

export function validateOrderStatus(status: string): asserts status is OrderStatus {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `status must be one of: ${ORDER_STATUSES.join(", ")}`,
    );
  }
}

type BookingRow = typeof bookings.$inferSelect;

export function mapBookingRow(row: BookingRow): BookingDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    wechat: row.wechat ?? null,
    email: row.email ?? null,
    preferredDate: row.preferredDate ?? null,
    numberOfPeople: row.numberOfPeople ?? null,
    activityType: row.activityType ?? null,
    interestedProject: row.interestedProject ?? null,
    message: row.message ?? null,
    locale: row.locale ?? null,
    timeSlotId: row.timeSlotId ?? null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type AdminBookingsService = ReturnType<typeof createAdminBookingsService>;

async function loadStoreContext(db: Db) {
  const settingsRepo = createSettingsRepository(db);
  const row = await settingsRepo.findSingleton();
  const contact: StoreContact = {
    phone: row?.phone,
    wechatId: row?.wechatId,
    email: row?.email,
  };
  return {
    storeName: row?.storeName ?? "YEZZ Studio",
    address: row?.address ?? null,
    businessHours: row?.businessHours ?? null,
    contact,
  };
}

export function createAdminBookingsService(db: Db) {
  const repo = createBookingsRepository(db);
  const slotsRepo = createTimeSlotsRepository(db);

  return {
    async list(): Promise<BookingDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map(mapBookingRow);
    },

    async getById(id: string): Promise<BookingDto> {
      const row = await repo.findById(id);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Booking not found");
      }
      return mapBookingRow(row);
    },

    async updateStatus(
      id: string,
      status: OrderStatus,
      adminNote?: string | null,
    ): Promise<BookingDto> {
      if (!status) {
        throw new AppError(400, "VALIDATION_ERROR", "status is required");
      }
      validateOrderStatus(status);

      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Booking not found");
      }

      const previous = existing.status;
      const row = await repo.updateStatus(id, status);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Booking not found");
      }

      const customerEmail = row.email?.trim();
      if (customerEmail && previous !== status) {
        try {
          const store = await loadStoreContext(db);
          const orderNumber = formatBookingOrderId(row.id, row.createdAt);
          let slotLabel: string | null = null;
          if (row.timeSlotId) {
            const slot = await slotsRepo.findById(row.timeSlotId);
            if (slot) {
              const dateStr =
                typeof slot.date === "string" ? slot.date : String(slot.date).slice(0, 10);
              slotLabel = `${dateStr} ${slot.startTime}–${slot.endTime}`;
            }
          }

          const ctx = {
            to: customerEmail,
            locale: row.locale,
            customerName: row.name,
            orderNumber,
            preferredDate: row.preferredDate,
            slotLabel,
            storeName: store.storeName,
            address: store.address,
            businessHours: store.businessHours,
            contact: store.contact,
            adminNote,
          };

          if (status === "contacted" && previous === "new") {
            await sendBookingStatusContactedEmail(ctx);
          } else if (status === "confirmed") {
            await sendBookingStatusConfirmedEmail(ctx);
          } else if (status === "cancelled") {
            await sendBookingStatusCancelledEmail(ctx);
          }
        } catch (error) {
          console.error("Booking status email failed:", error);
        }
      }

      return mapBookingRow(row);
    },
  };
}

export type { OrderStatus };
