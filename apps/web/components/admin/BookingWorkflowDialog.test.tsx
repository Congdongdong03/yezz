// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookingWorkflowDialog from "./BookingWorkflowDialog";

describe("BookingWorkflowDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await act(async () => root.unmount());
    container.remove();
  });

  it("shows final time and structural capacity only for confirmation", async () => {
    await act(async () =>
      root.render(
        <BookingWorkflowDialog
          action="confirm"
          booking={{
            id: "booking-1",
            kind: "experience",
            status: "pending_review",
            slot: {
              id: null,
              date: "2026-08-01",
              startTime: "10:00",
              endTime: "11:00",
              timeZone: "Australia/Melbourne",
            },
            numberOfPeople: 3,
          }}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open
        />,
      ),
    );

    expect(container.querySelector("input[name='finalDate']")).not.toBeNull();
    expect(container.querySelector("input[name='finalStartTime']")).not.toBeNull();
    expect(container.textContent).toContain("到店 3 人 · 普通预约上限 8 人");
    expect(container.querySelector("input[name='contactedCustomer']")).toBeNull();
    expect(container.querySelector("input[name='amountCents']")).toBeNull();
  });

  it("shows contact confirmation only for waitlist conversion", async () => {
    await act(async () =>
      root.render(
        <BookingWorkflowDialog
          action="confirm"
          booking={{
            id: "booking-2",
            kind: "experience",
            status: "waitlisted",
            slot: null,
            numberOfPeople: 2,
          }}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open
        />,
      ),
    );

    expect(
      container.querySelector("input[name='contactedCustomer']"),
    ).not.toBeNull();
  });

  it("shows exact in-store venue fee fields only for payment", async () => {
    await act(async () =>
      root.render(
        <BookingWorkflowDialog
          action="record_payment"
          booking={{
            id: "booking-3",
            kind: "party",
            status: "awaiting_in_store_payment",
            slot: null,
            numberOfPeople: 7,
          }}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
          open
        />,
      ),
    );

    expect(container.textContent).toContain("仅记录到店支付");
    expect(container.querySelector("select[name='amountCents']")).not.toBeNull();
    expect(container.querySelector("input[name='recordedAt']")).not.toBeNull();
    expect(container.textContent).not.toContain("在线支付");
  });

  it("blocks a party proposal whose start time is not on a half-hour boundary", async () => {
    const onConfirm = vi.fn();
    await act(async () =>
      root.render(
        <BookingWorkflowDialog
          action="propose_time"
          booking={{
            id: "booking-party",
            kind: "party",
            status: "pending_review",
            slot: {
              id: null,
              date: "2026-08-03",
              startTime: "15:30",
              endTime: "17:00",
              timeZone: "Australia/Melbourne",
            },
            numberOfPeople: 6,
          }}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
          open
        />,
      ),
    );

    const start = container.querySelector<HTMLInputElement>(
      "input[name='finalStartTime']",
    );
    const deadline = container.querySelector<HTMLInputElement>(
      "input[name='paymentDeadline']",
    );
    const form = container.querySelector("form");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(start, "15:29");
      start?.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(deadline, "2026-08-02T12:00");
      deadline?.dispatchEvent(new Event("input", { bubbles: true }));
      start?.dispatchEvent(new Event("invalid", { cancelable: true }));
    });
    expect(container.textContent).toContain("开始时间必须选择整点或半点");

    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("blocks a party proposal when the minute-precision payment deadline has already passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T07:21:23.000Z"));
    const onConfirm = vi.fn();
    await act(async () =>
      root.render(
        <BookingWorkflowDialog
          action="propose_time"
          booking={{
            id: "booking-party",
            kind: "party",
            status: "pending_review",
            slot: {
              id: null,
              date: "2026-08-06",
              startTime: "13:30",
              endTime: "15:00",
              timeZone: "Australia/Melbourne",
            },
            numberOfPeople: 5,
          }}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
          open
        />,
      ),
    );

    const deadline = container.querySelector<HTMLInputElement>(
      "input[name='paymentDeadline']",
    );
    const form = container.querySelector("form");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(deadline, "2026-08-03T17:21");
      deadline?.dispatchEvent(new Event("input", { bubbles: true }));
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(container.textContent).toContain("付款期限必须晚于当前时间");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
