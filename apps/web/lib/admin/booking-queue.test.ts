import { describe, expect, it } from "vitest";
import type { Booking } from "./types";
import {
  formatBookingQueueAttendance,
  formatBookingQueueDate,
  getBookingQueueDeliverySummary,
  getBookingQueueOfferingName,
} from "./booking-queue";

function ordinaryBooking(overrides: Partial<Booking> = {}): Booking {
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
    interestedProject: "Legacy project",
    message: null,
    locale: "zh",
    timeSlotId: "00000000-0000-4000-8000-000000000002",
    policyVersion: "2026-07-29",
    policyAcceptedAt: "2026-07-29T01:02:03.000Z",
    attendance: {
      participantCount: 2,
      youngChildCount: 1,
      accompanyingAdultCount: 1,
      totalCount: 3,
      durationMinutes: 60,
    },
    ordinaryDetails: null,
    partyDetails: null,
    status: "pending_review",
    offering: {
      id: "00000000-0000-4000-8000-000000000003",
      name: { en: "Phone case", zh: "手机壳" },
      price: "A$66.00–A$76.00",
    },
    slot: {
      id: "00000000-0000-4000-8000-000000000002",
      date: "2030-08-12",
      startTime: "10:00",
      endTime: "11:00",
      timeZone: "Australia/Melbourne",
    },
    notificationSummary: { latestStatus: "failed", failedCount: 2 },
    statusHistory: [],
    emailDeliveries: [],
    isUnread: true,
    createdAt: "2030-08-01T00:30:00.000Z",
    updatedAt: "2030-08-01T00:30:00.000Z",
    ...overrides,
  };
}

describe("booking queue presenter", () => {
  it("formats submission time in Melbourne local time", () => {
    expect(formatBookingQueueDate("2030-08-01T00:30:00.000Z")).toBe(
      "2030/08/01 10:30",
    );
    expect(formatBookingQueueDate(null)).toBe("—");
  });

  it("uses the Chinese offering name before English and legacy text", () => {
    expect(getBookingQueueOfferingName(ordinaryBooking())).toBe("手机壳");
    expect(
      getBookingQueueOfferingName(
        ordinaryBooking({
          offering: {
            id: null,
            name: { en: "Phone case", zh: "" },
            price: null,
          },
        }),
      ),
    ).toBe("Phone case");
    expect(
      getBookingQueueOfferingName(ordinaryBooking({ offering: null })),
    ).toBe("Legacy project");
  });

  it("summarizes ordinary and party attendance for counter staff", () => {
    expect(formatBookingQueueAttendance(ordinaryBooking())).toBe(
      "2 位制作，1 名儿童，1 位陪同（共 3 人）",
    );
    expect(
      formatBookingQueueAttendance(
        ordinaryBooking({
          kind: "party",
          attendance: {
            participantCount: 4,
            youngChildCount: null,
            accompanyingAdultCount: 2,
            totalCount: 6,
            durationMinutes: null,
          },
        }),
      ),
    ).toBe("4 位参与者，2 位家长（共 6 人）");
  });

  it("explains delivery failures and missing customer email", () => {
    expect(getBookingQueueDeliverySummary(ordinaryBooking())).toEqual({
      label: "发送失败",
      failureLabel: "2 封发送失败",
    });
    expect(
      getBookingQueueDeliverySummary(
        ordinaryBooking({
          email: null,
          notificationSummary: { latestStatus: null, failedCount: 0 },
        }),
      ),
    ).toEqual({ label: "无邮箱，需电话联系" });
  });
});
