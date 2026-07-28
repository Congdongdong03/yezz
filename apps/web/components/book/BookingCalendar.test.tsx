/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookingCalendar from "./BookingCalendar";

const testState = vi.hoisted(() => {
  const state: {
    fetchDaySlots: ReturnType<typeof vi.fn>;
    fetchMonthAvailability: ReturnType<typeof vi.fn>;
    locale: string;
    translate: (key: string, values?: { count?: number }) => string;
  } = {
    fetchDaySlots: vi.fn(),
    fetchMonthAvailability: vi.fn(),
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
    const today = new Date();
    year = today.getFullYear();
    monthPrefix = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}`;
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
    expect(button?.getAttribute("aria-selected")).toBe("false");

    await act(async () => button?.click());
    expect(button?.getAttribute("aria-selected")).toBe("true");
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
