// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminSchedulePage from "./page";
import * as api from "@/lib/admin/api";

vi.mock("@/lib/admin/api", () => ({
  getBookingCalendar: vi.fn(),
}));

describe("AdminSchedulePage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(api.getBookingCalendar).mockResolvedValue({
      from: "2026-07-30",
      to: "2026-08-05",
      timeZone: "Australia/Melbourne",
      days: [
        {
          date: "2026-07-30",
          timeZone: "Australia/Melbourne",
          isClosed: false,
          opensAt: "09:30",
          closesAt: "17:00",
          specialHours: {
            opensAt: "09:30",
            closesAt: "17:00",
            isClosed: false,
            note: "特别营业",
          },
          closures: [
            {
              id: "closure-1",
              startTime: "12:00",
              endTime: "12:30",
              note: "清洁",
            },
          ],
          intervals: [
            {
              startTime: "10:00",
              endTime: "10:30",
              ordinaryAttendance: 6,
              remainingOrdinaryCapacity: 2,
              partyBlocked: false,
              closed: false,
              ordinaryBookings: [
                {
                  bookingId: "ordinary-1",
                  bookingNumber: "booking-20260730-AAAA",
                  name: "普通预约",
                  status: "confirmed",
                  startTime: "10:00",
                  endTime: "11:00",
                  attendance: 6,
                  emailFailureCount: 1,
                },
              ],
              partyBookingIds: [],
            },
          ],
          ordinaryBookings: [],
          partyBlocks: [
            {
              bookingId: "party-1",
              bookingNumber: "booking-20260730-BBBB",
              name: "派对预约",
              status: "awaiting_in_store_payment",
              setupStart: "13:30",
              guestStart: "14:00",
              guestEnd: "16:00",
              cleanupEnd: "16:30",
              paymentDeadline: "2026-07-29T07:00:00.000Z",
              emailFailureCount: 0,
            },
          ],
          paymentDeadlines: [
            {
              bookingId: "party-1",
              bookingNumber: "booking-20260730-BBBB",
              deadline: "2026-07-29T07:00:00.000Z",
            },
          ],
          emailFailures: [
            {
              bookingId: "ordinary-1",
              bookingNumber: "booking-20260730-AAAA",
              count: 1,
            },
          ],
        },
      ],
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("renders 30-minute capacity rows and structurally separated party phases", async () => {
    await act(async () => root.render(<AdminSchedulePage />));
    await act(async () => {});

    expect(container.textContent).toContain("10:00–10:30");
    expect(container.textContent).toContain("已到 6 / 8");
    expect(container.textContent).toContain("剩余 2");
    expect(container.textContent).toContain("准备 13:30–14:00");
    expect(container.textContent).toContain("客人 14:00–16:00");
    expect(container.textContent).toContain("收尾 16:00–16:30");
  });

  it("uses one shared time rail and aligns party and closure spans to its half-hour rows", async () => {
    await act(async () => root.render(<AdminSchedulePage />));
    await act(async () => {});

    expect(container.querySelector("[role='grid']")).not.toBeNull();
    expect(
      container.querySelectorAll("[data-time-row='10:00']"),
    ).toHaveLength(1);
    expect(
      container.querySelector(
        "[data-date='2026-07-30'][data-time='10:00']",
      ),
    ).not.toBeNull();

    const setup = container.querySelector<HTMLElement>(
      "[data-party-phase='setup']",
    );
    const guest = container.querySelector<HTMLElement>(
      "[data-party-phase='guest']",
    );
    const cleanup = container.querySelector<HTMLElement>(
      "[data-party-phase='cleanup']",
    );
    const closure = container.querySelector<HTMLElement>(
      "[data-closure-id='closure-1']",
    );
    expect(setup?.style.gridRow).toBe("10 / 11");
    expect(guest?.style.gridRow).toBe("11 / 15");
    expect(cleanup?.style.gridRow).toBe("15 / 16");
    expect(closure?.style.gridRow).toBe("7 / 8");
  });

  it("shows special hours, closures, deadlines, failures, and detail links", async () => {
    await act(async () => root.render(<AdminSchedulePage />));
    await act(async () => {});

    expect(container.textContent).toContain("特别营业");
    expect(container.textContent).toContain("闭店 12:00–12:30");
    expect(container.textContent).toContain("付款期限");
    expect(container.textContent).toContain("邮件失败 1");
    expect(
      container.querySelector("a[href='/admin/bookings/party-1']"),
    ).not.toBeNull();
  });
});
