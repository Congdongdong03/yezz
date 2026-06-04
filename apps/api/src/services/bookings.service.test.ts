import { describe, expect, it } from "vitest";
import { AppError } from "../lib/errors.js";
import { createBookingsService } from "./bookings.service.js";
import { mapBookingRow } from "./admin/bookings.admin.service.js";
import { bookings } from "@yezz/db";

describe("createBookingsService", () => {
  it("rejects booking without name", async () => {
    const service = createBookingsService({} as never);
    await expect(service.create({ name: "  ", phone: "13800138000" })).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.code === "VALIDATION_ERROR",
    );
  });

  it("rejects invalid email", async () => {
    const service = createBookingsService({} as never);
    await expect(
      service.create({ name: "Test", phone: "13800138000", email: "not-an-email" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("mapBookingRow", () => {
  it("maps database row to API DTO", () => {
    const now = new Date("2026-06-04T00:00:00.000Z");
    const row: typeof bookings.$inferSelect = {
      id: "id-1",
      name: "Alice",
      phone: "138",
      wechat: null,
      email: null,
      preferredDate: "2026-06-10",
      numberOfPeople: 2,
      activityType: "date",
      interestedProject: null,
      message: null,
      status: "new",
      createdAt: now,
      updatedAt: now,
    };

    expect(mapBookingRow(row)).toMatchObject({
      id: "id-1",
      name: "Alice",
      status: "new",
      preferredDate: "2026-06-10",
    });
  });
});
