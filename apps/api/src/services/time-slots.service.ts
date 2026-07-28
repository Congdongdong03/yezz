import type { Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import {
  BOOKING_HORIZON_DAYS,
  assertSlotAllowed,
  getMelbourneDate,
  parseCalendarDate,
} from "../lib/slot-policy.js";
import {
  createTimeSlotsRepository,
  type TimeSlotCreateInput,
  type TimeSlotUpdateInput,
} from "../repositories/time-slots.repository.js";

export type TimeSlotDto = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  remaining: number;
  categoryId: string | null;
  isAvailable: boolean;
  notes: string | null;
  almostFull: boolean;
};
export type MonthAvailabilityDto = {
  dates: Array<{ date: string; status: "none" | "available" | "full" }>;
};
export type DaySlotsDto = { slots: TimeSlotDto[] };

type Repository = ReturnType<typeof createTimeSlotsRepository>;
type TimeSlotRow = Awaited<ReturnType<Repository["findById"]>>;

function dateValue(value: string | Date): string {
  return typeof value === "string"
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

function mapSlot(row: NonNullable<TimeSlotRow>): TimeSlotDto {
  const remaining = Math.max(0, row.capacity - row.bookedCount);
  return {
    id: row.id,
    date: dateValue(row.date),
    startTime: row.startTime,
    endTime: row.endTime,
    capacity: row.capacity,
    bookedCount: row.bookedCount,
    remaining,
    categoryId: row.categoryId ?? null,
    isAvailable: row.isAvailable,
    notes: row.notes ?? null,
    almostFull:
      row.isAvailable && remaining > 0 && remaining / row.capacity <= 0.2,
  };
}

function slotStatus(slots: TimeSlotDto[]): "none" | "available" | "full" {
  const open = slots.filter((slot) => slot.isAvailable);
  if (!open.length) return "none";
  return open.every((slot) => slot.remaining <= 0) ? "full" : "available";
}

function overlapError(): AppError {
  return new AppError(
    409,
    "SLOT_OVERLAP",
    "This time overlaps an existing slot for the same category",
  );
}

const MAX_BATCH_GENERATED_SLOTS = 1_000;

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23503"
  );
}

export type TimeSlotsService = ReturnType<typeof createTimeSlotsService>;

export function createTimeSlotsService(
  db: Db,
  dependencies?: { repo?: Repository; now?: () => Date },
) {
  const repo = dependencies?.repo ?? createTimeSlotsRepository(db);
  const now = dependencies?.now ?? (() => new Date());

  return {
    async getMonthAvailability(
      year: number,
      month: number,
      categoryId?: string,
    ) {
      const today = getMelbourneDate(now());
      if (
        !Number.isInteger(year) ||
        year < 1 ||
        year > 9999 ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {
        return { dates: [] } satisfies MonthAvailabilityDto;
      }
      const monthStart = parseCalendarDate(
        `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
      );
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const monthEnd = parseCalendarDate(
        `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      );
      const todayOrdinal = parseCalendarDate(today).ordinal;
      if (
        monthEnd.ordinal < todayOrdinal ||
        monthStart.ordinal > todayOrdinal + BOOKING_HORIZON_DAYS
      ) {
        return { dates: [] } satisfies MonthAvailabilityDto;
      }
      const rows = await repo.findInMonth(year, month, categoryId, today);
      const byDate = new Map<string, TimeSlotDto[]>();
      for (const row of rows) {
        const date = dateValue(row.date);
        if (date < today) continue;
        byDate.set(date, [...(byDate.get(date) ?? []), mapSlot(row)]);
      }
      return {
        dates: [...byDate.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, slots]) => ({ date, status: slotStatus(slots) })),
      } satisfies MonthAvailabilityDto;
    },

    async getDaySlots(date: string, categoryId?: string) {
      parseCalendarDate(date);
      const today = getMelbourneDate(now());
      if (date < today) return { slots: [] };
      const rows = await repo.findByDate(date, categoryId, today);
      return {
        slots: rows
          .map(mapSlot)
          .filter((slot) => slot.isAvailable && slot.remaining > 0),
      } satisfies DaySlotsDto;
    },

    async listAdmin() {
      return (await repo.findAllOrdered()).map(mapSlot);
    },

    async create(input: TimeSlotCreateInput) {
      assertSlotAllowed(input, now());
      const row = await db.transaction(async (tx) => {
        await repo.acquireScheduleLocks(
          [{ date: input.date, categoryId: input.categoryId }],
          tx,
        );
        if (await repo.findOverlapping(input, tx)) throw overlapError();
        return repo.create(input, tx);
      });
      return mapSlot(row);
    },

    async createBatch(options: {
      startDate: string;
      endDate: string;
      weekdays: number[];
      slots: Array<{ startTime: string; endTime: string; capacity: number }>;
      categoryId?: string | null;
      notes?: string | null;
    }) {
      const inputs = buildBatchInputs(options, now());
      for (const input of inputs) assertSlotAllowed(input, now());
      assertNoBatchOverlap(inputs);
      const rows = await db.transaction(async (tx) => {
        await repo.acquireScheduleLocks(
          inputs.map(({ date, categoryId }) => ({ date, categoryId })),
          tx,
        );
        for (const input of inputs) {
          if (await repo.findOverlapping(input, tx)) throw overlapError();
        }
        return repo.createMany(inputs, tx);
      });
      return rows.map(mapSlot);
    },

    async update(id: string, input: TimeSlotUpdateInput) {
      const row = await db.transaction(async (tx) => {
        const existing = await repo.findByIdForUpdate(id, tx);
        if (!existing)
          throw new AppError(404, "NOT_FOUND", "Time slot not found");
        const scheduleChanged =
          (input.startTime !== undefined &&
            input.startTime !== existing.startTime) ||
          (input.endTime !== undefined && input.endTime !== existing.endTime) ||
          (input.categoryId !== undefined &&
            input.categoryId !== existing.categoryId);
        if (existing.bookedCount > 0 && scheduleChanged) {
          throw new AppError(
            409,
            "SLOT_IMMUTABLE",
            "A reserved slot's time and category cannot change; close it and create a replacement",
          );
        }
        const capacity = input.capacity ?? existing.capacity;
        if (!Number.isInteger(capacity) || capacity < 1) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "capacity must be a positive integer",
          );
        }
        if (capacity < existing.bookedCount) {
          throw new AppError(
            409,
            "CAPACITY_CONFLICT",
            "Capacity cannot be less than the already booked count",
          );
        }
        if (scheduleChanged) {
          const candidate = {
            date: dateValue(existing.date),
            startTime: input.startTime ?? existing.startTime,
            endTime: input.endTime ?? existing.endTime,
            capacity,
            categoryId:
              input.categoryId === undefined
                ? existing.categoryId
                : input.categoryId,
          };
          assertSlotAllowed(candidate, now());
          await repo.acquireScheduleLocks(
            [
              { date: candidate.date, categoryId: existing.categoryId },
              { date: candidate.date, categoryId: candidate.categoryId },
            ],
            tx,
          );
          if (await repo.findOverlapping({ ...candidate, excludeId: id }, tx)) {
            throw overlapError();
          }
        }
        return repo.update(id, input, tx);
      });
      if (!row) throw new AppError(404, "NOT_FOUND", "Time slot not found");
      return mapSlot(row);
    },

    async remove(id: string) {
      try {
        return await db.transaction(async (tx) => {
          const existing = await repo.findByIdForUpdate(id, tx);
          if (!existing)
            throw new AppError(404, "NOT_FOUND", "Time slot not found");
          if (await repo.hasRequestReferences(id, tx)) {
            throw new AppError(
              409,
              "SLOT_REFERENCED",
              "This slot has customer requests and cannot be deleted; close it instead",
            );
          }
          const deleted = await repo.delete(id, tx);
          if (!deleted)
            throw new AppError(404, "NOT_FOUND", "Time slot not found");
          return { id: deleted.id };
        });
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new AppError(
            409,
            "SLOT_REFERENCED",
            "This slot has customer requests and cannot be deleted; close it instead",
          );
        }
        throw error;
      }
    },
  };
}

function buildBatchInputs(
  options: {
    startDate: string;
    endDate: string;
    weekdays: number[];
    slots: Array<{ startTime: string; endTime: string; capacity: number }>;
    categoryId?: string | null;
    notes?: string | null;
  },
  now: Date,
): TimeSlotCreateInput[] {
  const startDate = parseCalendarDate(options.startDate);
  const endDate = parseCalendarDate(options.endDate);
  if (startDate.ordinal > endDate.ordinal) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "startDate must not be after endDate",
    );
  }
  if (
    options.weekdays.length === 0 ||
    options.weekdays.some(
      (weekday) => !Number.isInteger(weekday) || weekday < 0 || weekday > 6,
    )
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "weekdays must contain values from 0 to 6",
    );
  }
  const today = parseCalendarDate(getMelbourneDate(now));
  if (
    startDate.ordinal < today.ordinal ||
    endDate.ordinal - today.ordinal > BOOKING_HORIZON_DAYS
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "batch dates must be within the booking horizon",
    );
  }
  const dayCount = endDate.ordinal - startDate.ordinal + 1;
  if (dayCount * options.slots.length > MAX_BATCH_GENERATED_SLOTS) {
    throw new AppError(
      400,
      "BATCH_TOO_LARGE",
      "Batch would create too many time slots",
    );
  }
  const start = new Date(`${options.startDate}T00:00:00Z`);
  const end = new Date(`${options.endDate}T00:00:00Z`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid date range");
  }
  if (!options.slots.length) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "At least one slot template is required",
    );
  }
  const weekdays = new Set(options.weekdays);
  const inputs: TimeSlotCreateInput[] = [];
  for (
    const cursor = new Date(start);
    cursor <= end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    if (!weekdays.has(cursor.getUTCDay())) continue;
    for (const slot of options.slots) {
      inputs.push({
        ...slot,
        date: cursor.toISOString().slice(0, 10),
        categoryId: options.categoryId,
        notes: options.notes,
      });
    }
  }
  if (inputs.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Batch selection generates no time slots",
    );
  }
  return inputs;
}

function assertNoBatchOverlap(inputs: TimeSlotCreateInput[]): void {
  const sorted = [...inputs].sort((a, b) =>
    `${a.date}:${a.categoryId ?? ""}:${a.startTime}`.localeCompare(
      `${b.date}:${b.categoryId ?? ""}:${b.startTime}`,
    ),
  );
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      previous.date === current.date &&
      (previous.categoryId ?? null) === (current.categoryId ?? null) &&
      previous.endTime > current.startTime
    ) {
      throw overlapError();
    }
  }
}
