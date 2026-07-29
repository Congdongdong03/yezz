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
});
