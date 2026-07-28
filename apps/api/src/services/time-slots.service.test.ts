import { describe, expect, it } from "vitest";
import { createTimeSlotsService } from "./time-slots.service.js";

const NOW = new Date("2026-07-28T00:00:00+10:00");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "slot-1",
    date: "2026-07-30",
    startTime: "10:00",
    endTime: "11:00",
    capacity: 4,
    bookedCount: 0,
    categoryId: null,
    isAvailable: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function harness(initialRows = [row()]) {
  const rows = initialRows;
  const repo = {
    findById: async (id: string) => rows.find((item) => item.id === id) ?? null,
    findByIdForUpdate: async (id: string) =>
      rows.find((item) => item.id === id) ?? null,
    findByDate: async (
      date: string,
      categoryId?: string,
      minimumDate?: string,
    ) =>
      rows.filter(
        (item) =>
          item.date === date &&
          (!minimumDate || item.date >= minimumDate) &&
          (!categoryId ||
            item.categoryId === null ||
            item.categoryId === categoryId),
      ),
    findInMonth: async (
      _year: number,
      _month: number,
      _categoryId?: string,
      minimumDate?: string,
    ) => rows.filter((item) => !minimumDate || item.date >= minimumDate),
    findAllOrdered: async () => rows,
    acquireScheduleLocks: async () => undefined,
    findOverlapping: async (input: {
      date: string;
      startTime: string;
      endTime: string;
      categoryId?: string | null;
      excludeId?: string;
    }) =>
      rows.find(
        (item) =>
          item.id !== input.excludeId &&
          item.date === input.date &&
          item.categoryId === (input.categoryId ?? null) &&
          item.startTime < input.endTime &&
          item.endTime > input.startTime,
      ) ?? null,
    create: async (input: Record<string, unknown>) => {
      const created = row({ id: `slot-${rows.length + 1}`, ...input });
      rows.push(created);
      return created;
    },
    createMany: async (inputs: Array<Record<string, unknown>>) =>
      Promise.all(inputs.map((input) => repo.create(input))),
    update: async (id: string, input: Record<string, unknown>) => {
      const index = rows.findIndex((item) => item.id === id);
      if (index < 0) return null;
      rows[index] = { ...rows[index], ...input };
      return rows[index];
    },
    hasRequestReferences: async () => false,
    delete: async (id: string) => {
      const index = rows.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const [deleted] = rows.splice(index, 1);
      return { id: deleted.id };
    },
  };
  const db = {
    transaction: async (callback: (tx: unknown) => unknown) => callback({}),
  };
  const service = createTimeSlotsService(db as never, {
    repo: repo as never,
    now: () => NOW,
  });
  return { service, repo, rows };
}

describe("time slot service invariants", () => {
  it("rejects overlap for the same null effective category", async () => {
    const { service } = harness();
    await expect(
      service.create({
        date: "2026-07-30",
        startTime: "10:30",
        endTime: "11:30",
        capacity: 2,
        categoryId: null,
      }),
    ).rejects.toMatchObject({ code: "SLOT_OVERLAP" });
  });

  it("allows the same clock range for a distinct category", async () => {
    const { service } = harness();
    const created = await service.create({
      date: "2026-07-30",
      startTime: "10:00",
      endTime: "11:00",
      capacity: 2,
      categoryId: "category-1",
    });
    expect(created.categoryId).toBe("category-1");
  });

  it("does not publish dates before Melbourne today", async () => {
    const { service } = harness([
      row({ id: "past", date: "2026-07-27" }),
      row({ id: "future", date: "2026-07-30" }),
    ]);
    await expect(service.getDaySlots("2026-07-27")).resolves.toEqual({
      slots: [],
    });
    await expect(service.getMonthAvailability(2026, 7)).resolves.toEqual({
      dates: [{ date: "2026-07-30", status: "available" }],
    });
  });

  it("prevents schedule identity changes after capacity is reserved", async () => {
    const { service } = harness([row({ bookedCount: 2 })]);
    await expect(
      service.update("slot-1", { startTime: "11:00", endTime: "12:00" }),
    ).rejects.toMatchObject({ code: "SLOT_IMMUTABLE" });
    await expect(
      service.update("slot-1", { categoryId: "category-1" }),
    ).rejects.toMatchObject({ code: "SLOT_IMMUTABLE" });
  });

  it("prevents capacity from shrinking below booked count", async () => {
    const { service } = harness([row({ bookedCount: 3 })]);
    await expect(
      service.update("slot-1", { capacity: 2 }),
    ).rejects.toMatchObject({
      code: "CAPACITY_CONFLICT",
    });
  });

  it("returns a clear conflict when a referenced slot is deleted", async () => {
    const { service, repo } = harness();
    repo.hasRequestReferences = async () => true;
    await expect(service.remove("slot-1")).rejects.toMatchObject({
      code: "SLOT_REFERENCED",
    });
  });
});
