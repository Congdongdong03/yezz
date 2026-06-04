import type { Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
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

export type DaySlotsDto = {
  slots: TimeSlotDto[];
};

type TimeSlotRow = Awaited<ReturnType<ReturnType<typeof createTimeSlotsRepository>["findById"]>>;

function formatDateValue(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function mapSlot(row: NonNullable<TimeSlotRow>): TimeSlotDto {
  const remaining = Math.max(0, row.capacity - row.bookedCount);
  const ratio = row.capacity > 0 ? remaining / row.capacity : 0;
  return {
    id: row.id,
    date: formatDateValue(row.date),
    startTime: row.startTime,
    endTime: row.endTime,
    capacity: row.capacity,
    bookedCount: row.bookedCount,
    remaining,
    categoryId: row.categoryId ?? null,
    isAvailable: row.isAvailable,
    notes: row.notes ?? null,
    almostFull: row.isAvailable && remaining > 0 && ratio <= 0.2,
  };
}

function slotStatus(slots: TimeSlotDto[]): "none" | "available" | "full" {
  const open = slots.filter((s) => s.isAvailable);
  if (open.length === 0) return "none";
  if (open.every((s) => s.remaining <= 0)) return "full";
  return "available";
}

export type TimeSlotsService = ReturnType<typeof createTimeSlotsService>;

export function createTimeSlotsService(db: Db) {
  const repo = createTimeSlotsRepository(db);

  return {
    async getMonthAvailability(
      year: number,
      month: number,
      categoryId?: string,
    ): Promise<MonthAvailabilityDto> {
      const rows = await repo.findInMonth(year, month, categoryId);
      const byDate = new Map<string, TimeSlotDto[]>();
      for (const row of rows) {
        const date = formatDateValue(row.date);
        const list = byDate.get(date) ?? [];
        list.push(mapSlot(row));
        byDate.set(date, list);
      }

      const dates = [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, slots]) => ({ date, status: slotStatus(slots) }));

      return { dates };
    },

    async getDaySlots(date: string, categoryId?: string): Promise<DaySlotsDto> {
      const rows = await repo.findByDate(date, categoryId);
      const slots = rows
        .map(mapSlot)
        .filter((s) => s.isAvailable && s.remaining > 0);
      return { slots };
    },

    async listAdmin(): Promise<TimeSlotDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map(mapSlot);
    },

    async create(input: TimeSlotCreateInput): Promise<TimeSlotDto> {
      validateSlotInput(input);
      const row = await repo.create(input);
      return mapSlot(row);
    },

    async createBatch(options: {
      startDate: string;
      endDate: string;
      weekdays: number[];
      slots: Array<{ startTime: string; endTime: string; capacity: number }>;
      categoryId?: string | null;
      notes?: string | null;
    }): Promise<TimeSlotDto[]> {
      const inputs = buildBatchInputs(options);
      const rows = await repo.createMany(inputs);
      return rows.map(mapSlot);
    },

    async update(id: string, input: TimeSlotUpdateInput): Promise<TimeSlotDto> {
      const row = await repo.update(id, input);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Time slot not found");
      }
      return mapSlot(row);
    },

    async remove(id: string): Promise<{ id: string }> {
      const row = await repo.delete(id);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Time slot not found");
      }
      return { id: row.id };
    },
  };
}

function validateSlotInput(input: TimeSlotCreateInput) {
  if (!input.date || !input.startTime || !input.endTime) {
    throw new AppError(400, "VALIDATION_ERROR", "date, startTime and endTime are required");
  }
  if (input.capacity < 1) {
    throw new AppError(400, "VALIDATION_ERROR", "capacity must be at least 1");
  }
}

function buildBatchInputs(options: {
  startDate: string;
  endDate: string;
  weekdays: number[];
  slots: Array<{ startTime: string; endTime: string; capacity: number }>;
  categoryId?: string | null;
  notes?: string | null;
}): TimeSlotCreateInput[] {
  const start = new Date(`${options.startDate}T12:00:00`);
  const end = new Date(`${options.endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid date range");
  }
  if (options.slots.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one slot template is required");
  }

  const weekdaySet = new Set(options.weekdays);
  const inputs: TimeSlotCreateInput[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    if (weekdaySet.has(cursor.getDay())) {
      const date = cursor.toISOString().slice(0, 10);
      for (const slot of options.slots) {
        inputs.push({
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
          categoryId: options.categoryId,
          notes: options.notes,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return inputs;
}
