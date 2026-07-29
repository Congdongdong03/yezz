/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/base";
import type { Booking } from "@/lib/admin/types";
import AdminBookingsPage from "./page";

const api = vi.hoisted(() => ({
  getAdminBookings: vi.fn(),
  getAdminBooking: vi.fn(),
  getBookingCalendar: vi.fn(),
  runBookingTransition: vi.fn(),
  recordBookingCharge: vi.fn(),
  recordBookingPayment: vi.fn(),
  recordBookingRefund: vi.fn(),
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
        data: [booking("pending_review")],
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
    api.getAdminBooking.mockReset();
    api.getBookingCalendar.mockReset();
    api.runBookingTransition
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

    const originalStatus = container.querySelector<HTMLButtonElement>(
      "button[aria-label='确认 Alice']",
    );
    expect(originalStatus).not.toBeNull();
    originalStatus?.focus();

    await act(async () => originalStatus?.click());

    const confirmButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((candidate) => candidate.textContent === "确认预约");
    expect(confirmButton).toBeDefined();
    await act(async () => confirmButton?.click());
    await act(async () => {});
  }

  it("replaces the four-state dropdown with valid action-specific controls", async () => {
    await act(async () => root.render(<AdminBookingsPage />));
    await act(async () => {});

    expect(
      container.querySelector("select[aria-label*='预约状态']"),
    ).toBeNull();
    expect(container.querySelector("button[aria-label='确认 Alice']")).not.toBeNull();
    expect(container.querySelector("button[aria-label='转候补 Alice']")).not.toBeNull();
    expect(container.querySelector("button[aria-label='拒绝 Alice']")).not.toBeNull();
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
      "记录已被其他操作更新，请查看最新状态",
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
