/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PartyBookingForm from "./PartyBookingForm";

const testState = vi.hoisted(() => ({
  submitPartyBooking: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    ({
      title: "Request this party package",
      manualPayment:
        "We manually confirm every request. No online payment is required; pay in store.",
      peopleRange: `${values?.min}–${values?.max} people`,
      name: "Name",
      phone: "Phone",
      email: "Email",
      people: "Number of people",
      message: "Message",
      chooseSchedule: "Choose date and time",
      selectSlot: "Choose an available time slot first",
      submit: "Send party request",
      submitting: "Sending…",
      successTitle: "Party request received",
      successBody:
        "We will contact you to confirm. No online payment is required; pay in store.",
      error: "Could not send your request. Try again or contact us.",
      nameRequired: "Name is required",
      phoneRequired: "Phone is required",
      emailRequired: "Email is required",
      emailInvalid: "Enter a valid email",
      peopleRequired: "Number of people is required",
      peopleRangeError: `${values?.min}–${values?.max} people required`,
    })[key] ?? key,
}));

vi.mock("@/components/book/BookingCalendar", () => ({
  default: ({
    onDateChange,
    onSelectSlot,
  }: {
    onDateChange: (date: string) => void;
    onSelectSlot: (slot: {
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      capacity: number;
      bookedCount: number;
      remaining: number;
      almostFull: boolean;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onDateChange("2030-08-12");
        onSelectSlot({
          id: "00000000-0000-4000-8000-000000000004",
          date: "2030-08-12",
          startTime: "12:00",
          endTime: "13:30",
          capacity: 12,
          bookedCount: 0,
          remaining: 12,
          almostFull: false,
        });
      }}
    >
      Choose test slot
    </button>
  ),
}));

vi.mock("@/lib/actions/booking", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/actions/booking")>();
  return {
    ...original,
    submitPartyBooking: testState.submitPartyBooking,
  };
});

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("PartyBookingForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.submitPartyBooking.mockReset();
    testState.submitPartyBooking.mockResolvedValue({
      success: true,
      bookingId: "party-booking-1",
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function renderForm() {
    await act(async () => {
      root.render(
        <PartyBookingForm
          party={{
            id: "00000000-0000-4000-8000-000000000003",
            name: { en: "Studio Party", zh: "工作室派对" },
            minPeople: 4,
            maxPeople: 12,
            priceIndicator: "A$ test fixture",
          }}
        />,
      );
    });
  }

  function setInput(name: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`[name="${name}"]`);
    expect(input).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("presents required contact, authoritative people range, and payment wording", async () => {
    await renderForm();

    expect(container.textContent).toContain("4–12 people");
    expect(container.textContent).toContain("manually confirm");
    expect(container.textContent).toContain("No online payment");
    expect(container.textContent).toContain("pay in store");
    expect(
      container.querySelector<HTMLInputElement>('[name="numberOfPeople"]')?.min,
    ).toBe("4");
    expect(
      container.querySelector<HTMLInputElement>('[name="numberOfPeople"]')?.max,
    ).toBe("12");
    for (const name of ["name", "phone", "email", "numberOfPeople"]) {
      expect(
        container.querySelector<HTMLInputElement>(`[name="${name}"]`)?.required,
      ).toBe(true);
    }
  });

  it("submits the selected package and exact slot through one retained attempt", async () => {
    await renderForm();
    setInput("name", "Mei");
    setInput("phone", "0430000001");
    setInput("email", "mei@example.com");
    setInput("numberOfPeople", "8");
    const slotButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find(({ textContent }) => textContent === "Choose test slot");
    await act(async () => slotButton?.click());
    const form = container.querySelector("form");
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );

    expect(testState.submitPartyBooking).toHaveBeenCalledOnce();
    const formData = testState.submitPartyBooking.mock
      .calls[0]?.[0] as FormData;
    expect(formData.get("partyPackageId")).toBe(
      "00000000-0000-4000-8000-000000000003",
    );
    expect(formData.get("timeSlotId")).toBe(
      "00000000-0000-4000-8000-000000000004",
    );
    expect(formData.get("name")).toBe("Mei");
    expect(container.textContent).toContain("Party request received");
    expect(container.textContent).toContain("pay in store");
  });

  it("associates inline field errors and the error summary with their relevant form controls", async () => {
    testState.submitPartyBooking.mockResolvedValue({
      success: false,
      errors: {
        name: ["Name needs review"],
        phone: ["Phone needs review"],
        email: ["Email needs review"],
        numberOfPeople: ["People needs review"],
        server: ["The request could not be sent"],
      },
    });
    await renderForm();
    setInput("name", "Mei");
    setInput("phone", "0430000001");
    setInput("email", "mei@example.com");
    setInput("numberOfPeople", "8");
    const slotButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find(({ textContent }) => textContent === "Choose test slot");
    await act(async () => slotButton?.click());
    const form = container.querySelector("form");
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );

    for (const [name, message] of [
      ["name", "Name needs review"],
      ["phone", "Phone needs review"],
      ["email", "Email needs review"],
      ["numberOfPeople", "People needs review"],
    ]) {
      const input = container.querySelector<HTMLInputElement>(
        `[name="${name}"]`,
      );
      const errorId = input?.getAttribute("aria-describedby");
      expect(errorId).toBeTruthy();
      expect(container.querySelector(`#${errorId}`)?.textContent).toBe(message);
    }

    const summary = container.querySelector('[role="alert"]');
    expect(summary?.id).toBeTruthy();
    expect(form?.getAttribute("aria-describedby")).toContain(summary?.id);
  });
});
