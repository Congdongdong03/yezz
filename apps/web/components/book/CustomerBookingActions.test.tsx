/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerBookingView } from "@/lib/api/customer-booking";
import CustomerBookingActions from "./CustomerBookingActions";

const TOKEN = "A".repeat(43);
const api = vi.hoisted(() => ({
  acceptProposedTime: vi.fn(),
  requestCustomerCancellation: vi.fn(),
  requestCustomerReschedule: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en", token: TOKEN }),
}));

vi.mock("@/lib/api/customer-booking", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/api/customer-booking")>();
  return { ...original, ...api };
});

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

function booking(
  allowedActions: CustomerBookingView["allowedActions"],
  overrides: Partial<CustomerBookingView> = {},
): CustomerBookingView {
  return {
    kind: "party",
    status: "confirmed_paid",
    locale: "en",
    offeringLabel: "Standard party",
    date: "2030-08-12",
    startTime: "12:00",
    endTime: "13:30",
    allowedActions,
    ...overrides,
  };
}

describe("CustomerBookingActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-08-12T00:00:00.000Z"));
    api.acceptProposedTime.mockReset().mockResolvedValue({
      status: "awaiting_in_store_payment",
    });
    api.requestCustomerCancellation.mockReset().mockResolvedValue({
      status: "cancellation_requested",
    });
    api.requestCustomerReschedule.mockReset().mockResolvedValue({
      status: "reschedule_requested",
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  async function renderActions(view: CustomerBookingView) {
    await act(async () => root.render(<CustomerBookingActions booking={view} />));
  }

  function findButton(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes(label),
    );
  }

  async function setInput(name: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`[name="${name}"]`);
    expect(input).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("renders only actions permitted by the safe read model", async () => {
    await renderActions(booking(["request_cancellation"]));

    expect(findButton("Request cancellation")).toBeDefined();
    expect(findButton("Accept proposed time")).toBeUndefined();
    expect(findButton("Request reschedule")).toBeUndefined();
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
    expect(container.textContent).not.toContain(TOKEN);
    expect(container.innerHTML).not.toContain(TOKEN);
  });

  it("accepts the displayed proposed time and replaces every control with a pending result", async () => {
    await renderActions(
      booking(["accept_time"], {
        status: "time_proposed",
        proposedTime: {
          date: "2030-08-13",
          startTime: "12:30",
          endTime: "14:00",
        },
      }),
    );

    expect(container.textContent).toContain("2030-08-13");
    expect(container.textContent).toContain("12:30–14:00");
    await act(async () => findButton("Accept proposed time")?.click());

    expect(api.acceptProposedTime).toHaveBeenCalledWith(TOKEN);
    expect(container.textContent).toContain(
      "Your request was recorded and awaits staff review",
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("submits a cancellation request without exposing the token", async () => {
    await renderActions(booking(["request_cancellation"]));
    await act(async () => findButton("Request cancellation")?.click());

    expect(api.requestCustomerCancellation).toHaveBeenCalledWith(TOKEN);
    expect(container.textContent).toContain(
      "Your request was recorded and awaits staff review",
    );
    expect(container.innerHTML).not.toContain(TOKEN);
  });

  it("associates reschedule errors and submits only a date and 30-minute start", async () => {
    await renderActions(booking(["request_reschedule"]));

    await act(async () => findButton("Request reschedule")?.click());
    const date = container.querySelector<HTMLInputElement>(
      '[name="rescheduleDate"]',
    );
    const time = container.querySelector<HTMLInputElement>(
      '[name="rescheduleStartTime"]',
    );
    expect(date?.type).toBe("date");
    expect(date?.min).toBe("2030-08-12");
    expect(date?.max).toBe("2030-08-19");
    expect(time?.type).toBe("time");
    expect(time?.step).toBe("1800");
    expect(date?.getAttribute("aria-invalid")).toBe("true");
    expect(date?.getAttribute("aria-describedby")).toBeTruthy();

    await setInput("rescheduleDate", "2030-08-14");
    await setInput("rescheduleStartTime", "13:30");
    await act(async () => findButton("Request reschedule")?.click());

    expect(api.requestCustomerReschedule).toHaveBeenCalledWith(TOKEN, {
      date: "2030-08-14",
      startTime: "13:30",
    });
    expect(container.textContent).toContain(
      "Your request was recorded and awaits staff review",
    );
  });

  it("rejects an out-of-policy reschedule before calling the API", async () => {
    await renderActions(booking(["request_reschedule"]));
    await setInput("rescheduleDate", "2030-08-12");
    await setInput("rescheduleStartTime", "11:30");
    await act(async () => findButton("Request reschedule")?.click());

    expect(api.requestCustomerReschedule).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "Choose a time at least two hours from now and within the next seven Melbourne calendar days.",
    );
  });

  it("uses the original request locale for customer action copy", async () => {
    await renderActions(
      booking(["request_cancellation"], {
        locale: "zh",
        offeringLabel: "标准派对",
      }),
    );

    expect(container.textContent).toContain("申请取消");
    expect(container.textContent).toContain("澳大利亚／墨尔本时间");
    expect(container.textContent).not.toContain("Request cancellation");
  });
});
