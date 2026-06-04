import { bookings, type Db } from "@yezz/db";
import { AppError } from "../../lib/errors.js";
import {
  createBookingsRepository,
  type OrderStatus,
} from "../../repositories/bookings.repository.js";

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
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type AdminBookingsService = ReturnType<typeof createAdminBookingsService>;

export function createAdminBookingsService(db: Db) {
  const repo = createBookingsRepository(db);

  function validateStatus(status: string): asserts status is OrderStatus {
    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `status must be one of: ${ORDER_STATUSES.join(", ")}`,
      );
    }
  }

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

    async updateStatus(id: string, status: OrderStatus): Promise<BookingDto> {
      if (!status) {
        throw new AppError(400, "VALIDATION_ERROR", "status is required");
      }
      validateStatus(status);
      const row = await repo.updateStatus(id, status);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Booking not found");
      }
      return mapBookingRow(row);
    },
  };
}

export type { OrderStatus };
