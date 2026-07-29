/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookingCalendar from "./BookingCalendar";

const testState = vi.hoisted(() => {
  const state: {
    fetchDaySlots: ReturnType<typeof vi.fn>;
    fetchMonthAvailability: ReturnType<typeof vi.fn>;
    getOrdinaryAvailability: ReturnType<typeof vi.fn>;
    locale: string;
    translate: (key: string, values?: { count?: number }) => string;
  } = {
    fetchDaySlots: vi.fn(),
    fetchMonthAvailability: vi.fn(),
    getOrdinaryAvailability: vi.fn(),
    locale: "en",
    translate: () => "",
  };
  state.translate = (key: string, values?: { count?: number }) =>
    ({
      loading: "Loading",
      legendAvailable: state.locale === "zh" ? "可预约" : "Available",
      legendFull: state.locale === "zh" ? "已满" : "Full",
      legendNone: state.locale === "zh" ? "无档期" : "No slots",
      pickSlot: "Choose a time slot",
      noSlots: "No slots",
      almostFull: "Almost full",
      remaining: `${values?.count ?? 0} spots left`,
      loadError: "Could not load",
      manualConfirmation: "Manual confirmation",
      prevMonth: "Previous month",
      nextMonth: "Next month",
      ordinaryDate: "Visit date",
      checking: "Checking sessions…",
      availableAction: "Request this time",
      waitlistAction: "Join waitlist",
      availableStatus: "Available",
      waitlistStatus: "Waitlist",
      ordinaryLoadError: "Could not check sessions. Try another date.",
      ordinaryEmpty: "No request times on this date.",
      melbourneTime: "Melbourne time",
    })[key] ?? key;
  return state;
});

vi.mock("next-intl", () => ({
  useLocale: () => testState.locale,
  useTranslations: () => testState.translate,
}));

vi.mock("@/lib/api/time-slots", () => ({
  fetchMonthAvailability: testState.fetchMonthAvailability,
  fetchDaySlots: testState.fetchDaySlots,
}));

vi.mock("@/lib/api/availability", () => ({
  getOrdinaryAvailability: testState.getOrdinaryAvailability,
}));

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("BookingCalendar date accessibility", () => {
  let container: HTMLDivElement;
  let root: Root;
  let monthPrefix: string;
  let year: number;

  beforeEach(() => {
    testState.locale = "en";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 1));
    year = 2026;
    monthPrefix = "2026-07";
    testState.fetchMonthAvailability.mockResolvedValue({
      dates: [
        { date: `${monthPrefix}-02`, status: "available" },
        { date: `${monthPrefix}-03`, status: "full" },
      ],
    });
    testState.fetchDaySlots.mockResolvedValue({ slots: [] });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  async function renderCalendar() {
    await act(async () => {
      root.render(
        <BookingCalendar
          people={1}
          selectedSlotId={null}
          onDateChange={vi.fn()}
          onSelectSlot={vi.fn()}
        />,
      );
    });
    await Promise.resolve();
    await act(async () => {});
  }

  it("announces the complete localized date and selection state", async () => {
    await renderCalendar();
    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((candidate) => candidate.textContent === "2");

    expect(button?.getAttribute("aria-label")).toContain("July");
    expect(button?.getAttribute("aria-label")).toContain(String(year));
    expect(button?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => button?.click());
    expect(button?.getAttribute("aria-pressed")).toBe("true");
  });

  it("marks unavailable dates as disabled while keeping the full-date label", async () => {
    await renderCalendar();
    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((candidate) => candidate.textContent === "3");

    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute("aria-disabled")).toBe("true");
    expect(button?.getAttribute("aria-label")).toContain("July");
  });

  it("uses a Chinese full-date label on the Chinese site", async () => {
    testState.locale = "zh";
    await renderCalendar();
    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((candidate) => candidate.textContent === "2");

    expect(button?.getAttribute("aria-label")).toContain(`${year}年`);
    expect(button?.getAttribute("aria-label")).toContain("2日");
  });
});

describe("BookingCalendar ordinary DIY availability", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.locale = "en";
    testState.getOrdinaryAvailability.mockReset().mockResolvedValue([
      {
        date: "2030-08-12",
        startTime: "10:00",
        endTime: "11:00",
        status: "available",
        remaining: 5,
      },
      {
        date: "2030-08-12",
        startTime: "10:30",
        endTime: "11:30",
        status: "waitlist",
        remaining: 1,
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

  async function chooseDate(onSelectOrdinarySlot = vi.fn()) {
    await act(async () => {
      root.render(
        <BookingCalendar
          onDateChange={vi.fn()}
          onSelectOrdinarySlot={onSelectOrdinarySlot}
          onSelectSlot={vi.fn()}
          ordinaryAvailability={{ attendance: 3, durationMinutes: 60 }}
          people={3}
          selectedOrdinaryStartTime={null}
          selectedSlotId={null}
        />,
      );
    });
    const input = container.querySelector<HTMLInputElement>('input[type="date"]');
    expect(input?.className).toContain("min-h-11");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, "2030-08-12");
    await act(async () => {
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {});
    return onSelectOrdinarySlot;
  }

  it("loads generated starts with the longest duration and total attendance", async () => {
    await chooseDate();

    expect(testState.getOrdinaryAvailability).toHaveBeenCalledWith({
      attendance: 3,
      date: "2030-08-12",
      durationMinutes: 60,
    });
    expect(container.textContent).toContain("10:00 – 11:00");
    expect(container.textContent).toContain("10:30 – 11:30");
    expect(container.textContent).toContain("Available");
    expect(container.textContent).toContain("Waitlist");
  });

  it("keeps available and waitlist starts as distinct keyboard buttons", async () => {
    const onSelect = await chooseDate();
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    );
    const available = buttons.find((button) =>
      button.getAttribute("aria-label")?.includes("Request this time"),
    );
    const waitlist = buttons.find((button) =>
      button.getAttribute("aria-label")?.includes("Join waitlist"),
    );

    expect(available?.type).toBe("button");
    expect(waitlist?.type).toBe("button");
    expect(available?.className).toContain("min-h-11");
    expect(waitlist?.className).toContain("min-h-11");
    await act(async () => waitlist?.click());
    expect(onSelect).toHaveBeenCalledWith({
      date: "2030-08-12",
      endTime: "11:30",
      remaining: 1,
      startTime: "10:30",
      status: "waitlist",
    });
  });
});
