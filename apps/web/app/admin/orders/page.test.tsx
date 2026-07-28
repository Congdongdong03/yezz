/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/base";
import type { CartOrder } from "@/lib/admin/types";
import AdminOrdersPage from "./page";

const api = vi.hoisted(() => ({
  getAdminOrders: vi.fn(),
  markNotificationsRead: vi.fn(),
  updateOrderStatus: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/lib/admin/api", () => api);

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

function order(status: "new" | "cancelled"): CartOrder {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Alice",
    phone: "0430000000",
    wechat: null,
    email: "alice@example.com",
    message: null,
    preferredDate: "2030-08-12",
    numberOfPeople: 2,
    locale: "zh",
    timeSlotId: "00000000-0000-4000-8000-000000000002",
    slot: {
      id: "00000000-0000-4000-8000-000000000002",
      date: "2030-08-12",
      startTime: "10:00",
      endTime: "11:00",
      timeZone: "Australia/Melbourne",
    },
    status,
    items: [
      {
        id: "item-1",
        projectId: "00000000-0000-4000-8000-000000000003",
        styleId: "00000000-0000-4000-8000-000000000004",
        projectName: { en: "Phone case", zh: "手机壳" },
        projectType: "product",
        styleName: { en: "Pink", zh: "粉色" },
        date: null,
        people: null,
        price: "$49",
        priceCurrency: "AUD",
        sortOrder: 0,
      },
    ],
    notificationSummary: {
      latestStatus: "pending",
      failedCount: 0,
    },
    statusHistory: [],
    emailDeliveries: [],
    createdAt: "2030-08-01T00:00:00.000Z",
    updatedAt: "2030-08-01T00:00:00.000Z",
  } as unknown as CartOrder;
}

describe("AdminOrdersPage product request parity", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    api.getAdminOrders
      .mockReset()
      .mockResolvedValueOnce({
        data: [order("new")],
        total: 1,
        page: 1,
        limit: 25,
      })
      .mockResolvedValueOnce({
        data: [order("cancelled")],
        total: 1,
        page: 1,
        limit: 25,
      });
    api.markNotificationsRead
      .mockReset()
      .mockResolvedValue({ type: "orders" });
    api.updateOrderStatus
      .mockReset()
      .mockRejectedValue(
        new ApiClientError(
          "The request changed. Refresh and try again.",
          "STATUS_CONFLICT",
          409,
          { currentStatus: "cancelled" },
        ),
      );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("shows exact contact, schedule, people, item price currency, and delivery state", async () => {
    await act(async () => root.render(<AdminOrdersPage />));
    await act(async () => {});

    expect(container.textContent).toContain("alice@example.com");
    expect(container.textContent).toContain("2030-08-12");
    expect(container.textContent).toContain("10:00–11:00");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("手机壳（粉色） · $49 AUD");
    expect(container.textContent).toContain("等待发送");
  });

  it("uses a dialog and restores focus after a safe stale-status refresh", async () => {
    await act(async () => root.render(<AdminOrdersPage />));
    await act(async () => {});

    const originalStatus = container.querySelector<HTMLSelectElement>(
      "select[aria-label='更新 Alice 的产品预约状态']",
    );
    expect(originalStatus).not.toBeNull();
    originalStatus?.focus();
    await act(async () => {
      if (!originalStatus) return;
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set;
      setValue?.call(originalStatus, "confirmed");
      originalStatus.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const confirmButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((candidate) => candidate.textContent === "确认预约");
    expect(confirmButton).toBeDefined();
    await act(async () => confirmButton?.click());
    await act(async () => {});

    const refreshedStatus = container.querySelector<HTMLSelectElement>(
      "select[aria-label='更新 Alice 的产品预约状态']",
    );
    expect(api.updateOrderStatus.mock.calls[0]?.[1]).toMatchObject({
      status: "confirmed",
      expectedStatus: "new",
    });
    expect(api.updateOrderStatus.mock.calls[0]?.[1].operationId).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
    expect(container.textContent).toContain(
      "产品预约状态已变化，列表已刷新，请重新选择操作",
    );
    expect(container.textContent).not.toContain(
      "The request changed. Refresh and try again.",
    );
    expect(container.querySelector("[role='dialog']")).toBeNull();
    expect(refreshedStatus?.value).toBe("cancelled");
    expect(document.activeElement).toBe(refreshedStatus);
  });
});
