/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PartyBookingForm, {
  type PartyBookingFormParty,
} from "./PartyBookingForm";

const testState = vi.hoisted(() => ({
  submitPartyBooking: vi.fn(),
  getPartyAvailability: vi.fn(),
}));

const messages: Record<string, string> = {
  title: "Request the Standard party",
  requestOnly:
    "Choose a preferred guest start. This is a request only; YezYY staff must manually confirm it and may propose another time.",
  manualPayment:
    "The A$95 venue fee/deposit is paid in store after staff confirmation. There is no online payment.",
  peopleRangeError: "Choose 4 to 8 DIY participants.",
  parentsRangeError: "Choose 1 or 2 accompanying parents.",
  birthdayAgeError: "The birthday child must be at least 5.",
  projectRequired: "Choose at least one DIY project.",
  policyRequired: "Accept the party booking policies to continue.",
  nameRequired: "Name is required.",
  phoneRequired: "Phone is required.",
  emailRequired: "Email is required.",
  emailInvalid: "Enter a valid email.",
  selectDate: "Choose a preferred date.",
  selectSlot: "Choose a preferred guest start.",
  name: "Contact name",
  phone: "Phone",
  email: "Email",
  birthdayChildName: "Birthday child's name",
  birthdayChildAge: "Birthday child's age",
  participants: "DIY participants",
  parents: "Accompanying parents",
  projects: "Project interests",
  projectCream: "Air-dry cream piping",
  projectMelty: "Melty bead craft",
  projectClay: "Paint clay figurine",
  projectBeading: "Beading",
  byoTitle: "What will you bring?",
  byoCake: "Cake",
  byoDrinks: "Drinks",
  byoFood: "Food",
  byoSnacks: "Snacks",
  cakeCutting: "Add staff cake cutting for A$15",
  specialRequirements: "Special requirements",
  desiredDate: "Preferred date",
  checking: "Checking party request times…",
  noTimes: "No candidate starts on this date.",
  availabilityError: "Could not check party times.",
  retryAvailability: "Check party times again",
  guestTime: "Guest time",
  requestTime: "Request 12:00–13:30",
  policyConsent:
    "I accept the party, age, supervision, payment, cancellation, refund, and privacy policies.",
  policySummary:
    "A full venue-fee refund is available when cancellation is requested at least 48 hours before the final guest start. Later cancellation is non-refundable.",
  submit: "Submit party request",
  submitting: "Sending request…",
  successTitle: "Party request received",
  successBody:
    "Your request awaits manual staff confirmation. We may propose another time. Pay the venue fee/deposit in store; no online payment was taken.",
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => messages[key] ?? key,
}));

vi.mock("@/lib/actions/booking", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/actions/booking")>();
  return {
    ...original,
    submitPartyBooking: testState.submitPartyBooking,
  };
});

vi.mock("@/lib/api/availability", () => ({
  getPartyAvailability: testState.getPartyAvailability,
}));

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const party: PartyBookingFormParty = {
  id: "00000000-0000-4000-8000-000000000003",
  name: { en: "Standard party", zh: "标准派对" },
  minPeople: 4,
  maxPeople: 8,
  priceIndicator: "A$95",
  guestDurationMinutes: 90,
  setupMinutes: 30,
  cleanupMinutes: 30,
  venueFeeCents: 9500,
  minSpendPerPersonCents: 4500,
  minParents: 1,
  maxParents: 2,
};

describe("PartyBookingForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.submitPartyBooking.mockReset().mockResolvedValue({
      success: true,
      bookingId: "party-booking-1",
    });
    testState.getPartyAvailability.mockReset().mockResolvedValue([
      {
        date: "2030-08-12",
        startTime: "12:00",
        endTime: "13:30",
        request_only: true,
      },
    ]);
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
      root.render(<PartyBookingForm party={party} />);
    });
  }

  async function setInput(name: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(
      `[name="${name}"]`,
    );
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

  async function setCheckbox(name: string, checked = true) {
    const input = container.querySelector<HTMLInputElement>(
      `[name="${name}"]`,
    );
    expect(input).not.toBeNull();
    await act(async () => {
      if (input && input.checked !== checked) input.click();
    });
  }

  async function submitForm() {
    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
  }

  it("shows request-only timing, exact package policy, and mobile semantic controls", async () => {
    await renderForm();

    expect(container.textContent).toContain("request only");
    expect(container.textContent).toContain("manually confirm");
    expect(container.textContent).toContain("may propose another time");
    expect(container.textContent).toContain("A$95");
    expect(container.textContent).toContain("paid in store");
    expect(container.textContent).toContain("There is no online payment");
    expect(container.textContent).toContain("at least 48 hours");
    expect(container.textContent).toContain("non-refundable");
    expect(
      container.querySelector<HTMLInputElement>('[name="participantCount"]')
        ?.min,
    ).toBe("4");
    expect(
      container.querySelector<HTMLInputElement>('[name="participantCount"]')
        ?.max,
    ).toBe("8");
    expect(
      container.querySelector<HTMLInputElement>('[name="parentCount"]')?.min,
    ).toBe("1");
    expect(
      container.querySelector<HTMLInputElement>('[name="parentCount"]')?.max,
    ).toBe("2");
    expect(
      container.querySelector<HTMLInputElement>('[name="desiredDate"]')?.type,
    ).toBe("date");
    expect(
      container.querySelector<HTMLInputElement>('[name="policyAccepted"]')
        ?.type,
    ).toBe("checkbox");
  });

  it("requires 4–8 participants, 1–2 parents, age 5, a project, and policy acceptance", async () => {
    await renderForm();
    await setInput("participantCount", "3");
    await setInput("parentCount", "0");
    await setInput("birthdayChildAge", "4");
    await submitForm();

    for (const [name, message] of [
      ["participantCount", "Choose 4 to 8 DIY participants."],
      ["parentCount", "Choose 1 or 2 accompanying parents."],
      ["birthdayChildAge", "The birthday child must be at least 5."],
    ]) {
      const input = container.querySelector<HTMLInputElement>(
        `[name="${name}"]`,
      );
      const describedBy = input?.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(container.querySelector(`#${describedBy}`)?.textContent).toBe(
        message,
      );
      expect(input?.getAttribute("aria-invalid")).toBe("true");
    }
    expect(container.textContent).toContain("Choose at least one DIY project.");
    expect(container.textContent).toContain(
      "Accept the party booking policies to continue.",
    );
    expect(testState.submitPartyBooking).not.toHaveBeenCalled();
  });

  it("loads candidate starts by package duration and submits all party details", async () => {
    await renderForm();
    await setInput("name", "Mei");
    await setInput("phone", "0430000001");
    await setInput("email", "mei@example.com");
    await setInput("birthdayChildName", "Lina");
    await setInput("birthdayChildAge", "7");
    await setInput("participantCount", "8");
    await setInput("parentCount", "2");
    await setInput("desiredDate", "2030-08-12");
    await act(async () => {});

    expect(testState.getPartyAvailability).toHaveBeenCalledWith({
      date: "2030-08-12",
      guestDurationMinutes: 90,
    });

    const timeButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.includes("12:00–13:30"));
    expect(timeButton).toBeDefined();
    await act(async () => timeButton?.click());
    expect(timeButton?.getAttribute("aria-pressed")).toBe("true");

    await setCheckbox("projectInterests", true);
    await setCheckbox("byoCake", true);
    await setCheckbox("byoFood", true);
    await setCheckbox("cakeCuttingRequested", true);
    await setCheckbox("policyAccepted", true);
    await submitForm();

    expect(testState.submitPartyBooking).toHaveBeenCalledOnce();
    const formData = testState.submitPartyBooking.mock.calls[0]?.[0] as FormData;
    expect(formData.get("partyPackageId")).toBe(party.id);
    expect(formData.get("desiredDate")).toBe("2030-08-12");
    expect(formData.get("desiredStartTime")).toBe("12:00");
    expect(formData.get("participantCount")).toBe("8");
    expect(formData.get("parentCount")).toBe("2");
    expect(formData.get("projectInterests")).toBe(
      JSON.stringify(["Air-dry cream piping"]),
    );
    expect(formData.get("byoCake")).toBe("true");
    expect(formData.get("byoDrinks")).toBe("false");
    expect(formData.get("byoFood")).toBe("true");
    expect(formData.get("byoSnacks")).toBe("false");
    expect(formData.get("cakeCuttingRequested")).toBe("true");
    expect(formData.get("policyVersion")).toBe("2026-07-29");
    expect(formData.get("policyAccepted")).toBe("true");
    expect(container.textContent).toContain("Party request received");
    expect(container.textContent).toContain(
      "awaits manual staff confirmation",
    );
    expect(container.textContent).toContain("no online payment was taken");
  });
});
