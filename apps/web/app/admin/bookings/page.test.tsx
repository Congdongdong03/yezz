/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/base";
import type { Booking } from "@/lib/admin/types";
import { readCachedBookingCalendarDay } from "@/lib/admin/calendar-store";
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
    policyVersion: "2026-07-29",
    policyAcceptedAt: "2026-07-29T01:02:03.000Z",
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

  it("shows the persisted policy version in the booking list", async () => {
    await act(async () => root.render(<AdminBookingsPage />));
    await act(async () => {});

    expect(container.textContent).toContain("政策 2026-07-29");
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

  it("submits the selected final slot and stores the refreshed calendar day after confirmation", async () => {
    api.runBookingTransition.mockReset().mockResolvedValue(booking("confirmed"));
    const updated = {
      ...booking("confirmed"),
      slot: {
        ...booking("confirmed").slot!,
        date: "2030-08-13",
        startTime: "11:30",
        endTime: "12:30",
      },
    };
    api.getAdminBooking.mockReset().mockResolvedValue(updated);
    api.getBookingCalendar.mockReset().mockResolvedValue({
      from: "2030-08-13",
      to: "2030-08-13",
      timeZone: "Australia/Melbourne",
      days: [
        {
          date: "2030-08-13",
          timeZone: "Australia/Melbourne",
          isClosed: false,
          opensAt: "09:30",
          closesAt: "17:00",
          specialHours: null,
          closures: [],
          intervals: [],
          ordinaryBookings: [],
          partyBlocks: [],
          paymentDeadlines: [],
          emailFailures: [],
        },
      ],
    });

    await act(async () => root.render(<AdminBookingsPage />));
    await act(async () => {});
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>("button[aria-label='确认 Alice']")
        ?.click(),
    );

    const date = container.querySelector<HTMLInputElement>(
      "input[name='finalDate']",
    );
    const start = container.querySelector<HTMLInputElement>(
      "input[name='finalStartTime']",
    );
    expect(date).not.toBeNull();
    expect(start).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(date, "2030-08-13");
      date?.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(start, "11:30");
      start?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const confirm = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((candidate) => candidate.textContent === "确认预约");
    await act(async () => confirm?.click());
    await act(async () => {});

    expect(api.runBookingTransition).toHaveBeenCalledWith(
      booking("pending_review").id,
      expect.objectContaining({
        expectedStatus: "pending_review",
        toStatus: "confirmed",
        newDate: "2030-08-13",
        newStartTime: "11:30",
      }),
    );
    expect(api.getBookingCalendar).toHaveBeenCalledWith(
      "2030-08-13",
      "2030-08-13",
    );
    expect(readCachedBookingCalendarDay("2030-08-13")).toMatchObject({
      date: "2030-08-13",
    });
    expect(container.textContent).toContain("2030-08-13");
    expect(container.textContent).toContain("11:30–12:30");
  });
});
