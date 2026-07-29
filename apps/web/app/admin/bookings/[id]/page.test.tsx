/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminBookingDetailPage from "./page";

const api = vi.hoisted(() => ({
  getAdminBooking: vi.fn(),
  getBookingCalendar: vi.fn(),
  runBookingTransition: vi.fn(),
  recordBookingCharge: vi.fn(),
  recordBookingPayment: vi.fn(),
  recordBookingRefund: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock("@/lib/admin/api", () => api);

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const booking = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "party",
  name: "Mei",
  phone: "0430000001",
  wechat: null,
  email: "mei@example.com",
  preferredDate: "2030-08-15",
  numberOfPeople: 5,
  activityType: "party",
  interestedProject: null,
  message: null,
  locale: "zh",
  timeSlotId: null,
  policyVersion: "2026-07-30",
  policyAcceptedAt: "2030-08-01T00:00:00.000Z",
  status: "confirmed_paid",
  offering: null,
  slot: null,
  notificationSummary: { latestStatus: null, failedCount: 0 },
  statusHistory: [],
  emailDeliveries: [],
  attendance: {
    participantCount: 4,
    youngChildCount: null,
    accompanyingAdultCount: 1,
    totalCount: 5,
    durationMinutes: null,
  },
  ordinaryDetails: null,
  partyDetails: {
    birthdayChildName: "Mia",
    birthdayChildAge: 6,
    participantCount: 4,
    parentCount: 1,
    desiredDate: "2030-08-14",
    desiredStartTime: "13:00",
    byo: { cake: true, drinks: true, food: false, snacks: true },
    cakeCuttingRequested: true,
    specialRequirements: "Nut-free table",
    finalSchedule: {
      date: "2030-08-15",
      setupStart: "12:30",
      guestStart: "13:00",
      guestEnd: "14:30",
      cleanupEnd: "15:00",
    },
    venueFeeCents: 9500,
    minSpendPerPersonCents: 4500,
    paymentDeadline: "2030-08-10T03:00:00.000Z",
    paidAt: "2030-08-09T03:00:00.000Z",
    paidAmountCents: 9500,
    refundedAt: null,
    charges: [
      {
        id: "00000000-0000-4000-8000-000000000010",
        type: "venue_fee",
        amountCents: 9500,
        note: null,
        createdAt: "2030-08-09T03:00:00.000Z",
        recordedBy: { id: "staff-1", name: "收费员工" },
      },
      {
        id: "00000000-0000-4000-8000-000000000011",
        type: "cake_cutting",
        amountCents: 1500,
        note: "Birthday cake",
        createdAt: "2030-08-09T03:05:00.000Z",
        recordedBy: { id: "staff-1", name: "收费员工" },
      },
      {
        id: "00000000-0000-4000-8000-000000000012",
        type: "refund",
        amountCents: 9500,
        note: "Customer cancellation",
        createdAt: "2030-08-10T03:00:00.000Z",
        recordedBy: { id: "staff-2", name: "退款员工" },
      },
    ],
  },
  createdAt: "2030-08-01T00:00:00.000Z",
  updatedAt: "2030-08-01T00:00:00.000Z",
};

describe("AdminBookingDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    api.getAdminBooking.mockReset().mockResolvedValue(booking);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("shows party-specific attendance, arrangements, and the in-store charge ledger", async () => {
    await act(async () => root.render(<AdminBookingDetailPage params={Promise.resolve({ id: booking.id })} />));
    await act(async () => {});

    expect(container.textContent).toContain("派对专属信息");
    expect(container.textContent).toContain("Mia");
    expect(container.textContent).toContain("4 位参与者，1 位家长");
    expect(container.textContent).toContain("自带蛋糕、饮料、零食");
    expect(container.textContent).toContain("场地费与费用台账");
    expect(container.textContent).toContain("场地费");
    expect(container.textContent).toContain("切蛋糕服务");
    expect(container.textContent).toContain("A$95.00");
    expect(container.textContent).toContain("A$15.00");
    expect(container.textContent).toContain("-A$95.00");
    expect(container.textContent).toContain("Birthday cake");
  });
});
