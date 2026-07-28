/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/base";
import type { Booking } from "@/lib/admin/types";
import AdminBookingsPage from "./page";

const api = vi.hoisted(() => ({
  getAdminBookings: vi.fn(),
  markNotificationsRead: vi.fn(),
  updateBookingStatus: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

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

function booking(status: Booking["status"]): Booking {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "experience",
    name: "Alice",
    phone: "0430000000",
    wechat: null,
    email: "alice@example.com",
    preferredDate: "2030-08-12",
    numberOfPeople: 2,
    activityType: "experience",
    interestedProject: "Phone case",
    message: null,
    locale: "zh",
    timeSlotId: "00000000-0000-4000-8000-000000000002",
    status,
    offering: {
      id: "00000000-0000-4000-8000-000000000003",
      name: { en: "Phone case", zh: "手机壳" },
      price: "From $43",
    },
    slot: {
      id: "00000000-0000-4000-8000-000000000002",
      date: "2030-08-12",
      startTime: "10:00",
      endTime: "11:00",
      timeZone: "Australia/Melbourne",
    },
    notificationSummary: {
      latestStatus: "pending",
      failedCount: 0,
    },
    statusHistory: [],
    emailDeliveries: [],
    createdAt: "2030-08-01T00:00:00.000Z",
    updatedAt: "2030-08-01T00:00:00.000Z",
  };
}

function partyBooking(): Booking {
  return {
    ...booking("confirmed"),
    kind: "party",
    name: "Mei",
    phone: "0430000001",
    email: "mei@example.com",
    numberOfPeople: 8,
    activityType: "party",
    interestedProject: "Spoofed package label",
    offering: {
      id: "00000000-0000-4000-8000-000000000004",
      name: { en: "Studio Party", zh: "工作室派对" },
      price: "A$ test fixture",
    },
    slot: {
      id: "00000000-0000-4000-8000-000000000005",
      date: "2030-08-12",
      startTime: "12:00",
      endTime: "13:30",
      timeZone: "Australia/Melbourne",
    },
  };
}

describe("AdminBookingsPage stale status focus", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    api.getAdminBookings
      .mockReset()
      .mockResolvedValueOnce({
        data: [booking("new")],
        total: 1,
        page: 1,
        limit: 100,
      })
      .mockResolvedValueOnce({
        data: [booking("cancelled")],
        total: 1,
        page: 1,
        limit: 100,
      });
    api.markNotificationsRead.mockReset().mockResolvedValue({ type: "bookings" });
    api.updateBookingStatus
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

  async function submitStaleStatusChange() {
    await act(async () => root.render(<AdminBookingsPage />));
    await act(async () => {});

    const originalStatus = container.querySelector<HTMLSelectElement>(
      "select[aria-label='更新 Alice 的预约状态']",
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
  }

  it("restores focus to the surviving status control after a stale refresh", async () => {
    await submitStaleStatusChange();

    const refreshedStatus = container.querySelector<HTMLSelectElement>(
      "select[aria-label='更新 Alice 的预约状态']",
    );
    expect(api.getAdminBookings).toHaveBeenCalledTimes(2);
    expect(container.querySelector("[role='dialog']")).toBeNull();
    expect(refreshedStatus?.value).toBe("cancelled");
    expect(document.activeElement?.isConnected).toBe(true);
    expect(document.activeElement).toBe(refreshedStatus);
  });

  it("waits until the existing control is re-enabled when stale refresh fails", async () => {
    api.getAdminBookings
      .mockReset()
      .mockResolvedValueOnce({
        data: [booking("new")],
        total: 1,
        page: 1,
        limit: 100,
      })
      .mockRejectedValueOnce(new Error("raw transport failure"));

    await submitStaleStatusChange();

    const statusControl = container.querySelector<HTMLSelectElement>(
      "select[aria-label='更新 Alice 的预约状态']",
    );
    expect(statusControl?.disabled).toBe(false);
    expect(document.activeElement?.isConnected).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(statusControl);
    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      "预约记录加载失败，请稍后重试",
    );
    expect(container.textContent).not.toContain("raw transport failure");
  });

  it("focuses the page heading when a stale refresh removes the row", async () => {
    api.getAdminBookings
      .mockReset()
      .mockResolvedValueOnce({
        data: [booking("new")],
        total: 1,
        page: 1,
        limit: 100,
      })
      .mockResolvedValueOnce({
        data: [],
        total: 0,
        page: 1,
        limit: 100,
      });

    await submitStaleStatusChange();

    const heading = container.querySelector<HTMLHeadingElement>("h1");
    expect(container.textContent).toContain(
      "预约状态已变化，列表已刷新，请重新选择操作",
    );
    expect(heading?.tabIndex).toBe(-1);
    expect(document.activeElement?.isConnected).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(heading);
  });

  it("distinguishes a party request and shows exact package/contact/slot/status/delivery", async () => {
    api.getAdminBookings.mockReset().mockResolvedValue({
      data: [partyBooking()],
      total: 1,
      page: 1,
      limit: 100,
    });

    await act(async () => root.render(<AdminBookingsPage />));
    await act(async () => {});

    expect(container.textContent).toContain("聚会预约");
    expect(container.textContent).toContain("工作室派对");
    expect(container.textContent).toContain("A$ test fixture");
    expect(container.textContent).toContain("0430000001");
    expect(container.textContent).toContain("mei@example.com");
    expect(container.textContent).toContain("2030-08-12");
    expect(container.textContent).toContain("12:00–13:30");
    expect(container.textContent).toContain("已确认");
    expect(container.textContent).toContain("等待发送");
  });
});
