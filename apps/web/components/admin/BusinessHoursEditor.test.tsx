// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BusinessHoursEditor from "./BusinessHoursEditor";
import type { AdminSchedule } from "@/lib/admin/types";

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

  it("shows the explicit booking acknowledgement for shortened special hours", async () => {
    await act(async () =>
      root.render(
        <BusinessHoursEditor onChanged={vi.fn()} schedule={schedule} />,
      ),
    );

    const specialHoursForm = container.querySelectorAll("form")[0];
    expect(
      specialHoursForm?.querySelectorAll("input[type='checkbox']"),
    ).toHaveLength(2);
    expect(specialHoursForm?.textContent).toContain("已核对现有预约");
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
