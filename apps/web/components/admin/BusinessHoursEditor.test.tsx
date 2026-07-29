// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BusinessHoursEditor from "./BusinessHoursEditor";
import type { AdminSchedule } from "@/lib/admin/types";
import { ApiClientError } from "@/lib/api/base";

const adminApi = vi.hoisted(() => ({
  createStudioClosure: vi.fn(),
  deleteStudioClosure: vi.fn(),
  saveSpecialHours: vi.fn(),
  updateRequestSwitches: vi.fn(),
  updateWeeklyHours: vi.fn(),
}));

vi.mock("@/lib/admin/api", () => adminApi);

const schedule: AdminSchedule = {
  timeZone: "Australia/Melbourne",
  weekly: Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opensAt: weekday === 0 ? "10:00" : "09:30",
    closesAt: "17:00",
    isClosed: false,
  })),
  specialHours: [],
  closures: [],
  requestSwitches: {
    database: { experience: true, party: false, product: false },
    deploymentHardGate: { experience: false, party: true, product: false },
    effective: { experience: false, party: false, product: false },
  },
};

describe("BusinessHoursEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    adminApi.saveSpecialHours.mockReset();
    adminApi.saveSpecialHours.mockResolvedValue({});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("edits one pair per weekday and exposes special and partial closures", async () => {
    await act(async () =>
      root.render(
        <BusinessHoursEditor onChanged={vi.fn()} schedule={schedule} />,
      ),
    );

    expect(container.querySelectorAll("[data-weekday-row]")).toHaveLength(7);
    expect(container.textContent).toContain("全天特别闭店");
    expect(container.textContent).toContain("特别营业时间");
    expect(container.textContent).toContain("部分时段闭店");
    expect(container.textContent).toContain("Australia/Melbourne");
  });

  it("retries a conflicting special-hours save only after the operator acknowledges existing bookings", async () => {
    const onChanged = vi.fn();
    adminApi.saveSpecialHours
      .mockRejectedValueOnce(
        new ApiClientError("Conflicting bookings", "SCHEDULE_CONFLICT", 409, {
          affectedBookingNumbers: ["YZZ-20300812-001"],
        }),
      )
      .mockResolvedValueOnce({});
    await act(async () =>
      root.render(
        <BusinessHoursEditor onChanged={onChanged} schedule={schedule} />,
      ),
    );

    const specialHoursForm = container.querySelectorAll("form")[0];
    await act(async () => {
      specialHoursForm?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(adminApi.saveSpecialHours).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ acknowledgeExistingBookings: false }),
    );
    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "YZZ-20300812-001",
    );

    const acknowledgement = specialHoursForm?.querySelectorAll<HTMLInputElement>(
      "input[type='checkbox']",
    )[1];
    await act(async () => acknowledgement?.click());
    await act(async () => {
      specialHoursForm?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(adminApi.saveSpecialHours).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ acknowledgeExistingBookings: true }),
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "特别营业时间已保存",
    );
  });

  it("distinguishes database, deployment, and effective switches and locks product", async () => {
    await act(async () =>
      root.render(
        <BusinessHoursEditor onChanged={vi.fn()} schedule={schedule} />,
      ),
    );

    expect(container.textContent).toContain("数据库开关");
    expect(container.textContent).toContain("部署硬门");
    expect(container.textContent).toContain("实际可用");
    const product = container.querySelector<HTMLInputElement>(
      "input[name='switch-product']",
    );
    expect(product?.disabled).toBe(true);
    expect(product?.checked).toBe(false);
  });
});
