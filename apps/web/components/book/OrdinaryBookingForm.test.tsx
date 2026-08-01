/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrdinaryBookingForm from "./OrdinaryBookingForm";

const testState = vi.hoisted(() => ({
  locale: "en",
  selectedStatus: "available" as "available" | "waitlist",
  getOrdinaryAvailability: vi.fn(),
  submitBooking: vi.fn(),
}));

const en: Record<string, string> = {
  formLabel: "Ordinary DIY booking request",
  intro:
    "Choose people, projects, date and time, then send a request for manual confirmation.",
  stepPeople: "People",
  stepProjects: "Projects",
  stepSchedule: "Date & time",
  stepContact: "Contact & policy",
  scheduleReady: "Choose a date and start time in Melbourne time.",
  scheduleNotReady:
    "Complete people and project choices before checking sessions.",
  name: "Name",
  phone: "Phone",
  email: "Email",
  message: "Notes for YezYY",
  submitBooking: "Send booking request",
  submitWaitlist: "Join the waitlist",
  submitting: "Sending request…",
  successTitle: "Request received",
  successBooking:
    "Your request was received and awaits manual staff confirmation. Pay in store.",
  successWaitlist:
    "Your waitlist request was received and awaits manual staff confirmation. Staff will contact you manually if capacity becomes available. Pay in store.",
  staleSlot:
    "That time just changed. Review the refreshed available and waitlist times.",
  selectSlot: "Choose an available or waitlist time.",
  nameRequired: "Name is required",
  phoneRequired: "Phone is required",
  emailRequired: "Email is required",
  emailInvalid: "Enter a valid email",
  attendanceInvalid: "Review the attendance details.",
  itemsInvalid: "Choose exactly one project for each DIY participant.",
  policyRequired: "Accept the booking policies to continue.",
  genericError: "Could not send your request. Try again or contact YezYY.",
  payInStore: "Prices are in AUD. Pay in store; there is no online payment.",
  contactFallbackTitle: "Online requests are not available yet",
};

const zh: Record<string, string> = {
  formLabel: "普通手作预约申请",
  intro: "依次选择人数、项目、日期时段，再提交申请等待人工确认。",
  stepPeople: "人数",
  stepProjects: "项目",
  stepSchedule: "日期与时段",
  stepContact: "联系信息与政策",
  scheduleReady: "请按墨尔本时间选择日期和开始时段。",
  scheduleNotReady: "请先完成人数和项目选择，再查看时段。",
  name: "姓名",
  phone: "电话",
  email: "邮箱",
  message: "给 YezYY 的留言",
  submitBooking: "提交预约申请",
  submitWaitlist: "加入候补",
  submitting: "正在提交申请…",
  successTitle: "申请已收到",
  successBooking: "您的申请已收到，正在等待员工人工确认。请到店付款。",
  successWaitlist:
    "您的候补申请已收到，正在等待员工人工确认。如有空位，员工会人工联系您。请到店付款。",
  staleSlot: "该时段刚刚发生变化，请重新查看已刷新的可用或候补时段。",
  selectSlot: "请选择可用或候补时段。",
  nameRequired: "请填写姓名",
  phoneRequired: "请填写电话",
  emailRequired: "请填写邮箱",
  emailInvalid: "请输入有效邮箱",
  attendanceInvalid: "请检查到店人数。",
  itemsInvalid: "每位手作参与者须选择一个项目。",
  policyRequired: "请接受预约政策后继续。",
  genericError: "申请发送失败，请重试或联系 YezYY。",
  payInStore: "所有价格均为澳元。请到店付款；网站不提供线上付款。",
  contactFallbackTitle: "线上申请暂未开放",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (testState.locale === "zh" ? zh : en)[key] ?? key,
}));

vi.mock("@/components/book/BookingCalendar", () => ({
  default: ({
    onDateChange,
    onSelectOrdinarySlot,
    ordinaryCalendarId,
    ordinaryRefreshKey,
    ordinaryScheduleErrorId,
    ordinaryScheduleInvalid,
    selectedOrdinaryStartTime,
  }: {
    onDateChange: (date: string) => void;
    onSelectOrdinarySlot: (slot: {
      date: string;
      startTime: string;
      endTime: string;
      status: "available" | "waitlist";
      remaining: number;
    }) => void;
    ordinaryCalendarId?: string;
    ordinaryRefreshKey?: number;
    ordinaryScheduleErrorId?: string;
    ordinaryScheduleInvalid?: boolean;
    selectedOrdinaryStartTime?: string | null;
  }) => (
    <div
      aria-describedby={ordinaryScheduleErrorId}
      aria-invalid={ordinaryScheduleInvalid}
      data-refresh-key={ordinaryRefreshKey}
      data-selected-start={selectedOrdinaryStartTime ?? ""}
      data-testid="ordinary-calendar"
    >
      <button id={ordinaryCalendarId} type="button">
        Test date control
      </button>
      <button
        type="button"
        onClick={() => {
          onDateChange("2030-08-12");
          onSelectOrdinarySlot({
            date: "2030-08-12",
            startTime: "10:30",
            endTime: "11:30",
            status: testState.selectedStatus,
            remaining: testState.selectedStatus === "available" ? 6 : 0,
          });
        }}
      >
        Choose generated test start
      </button>
    </div>
  ),
}));

vi.mock("@/lib/api/availability", () => ({
  getOrdinaryAvailability: testState.getOrdinaryAvailability,
}));

vi.mock("@/lib/actions/booking", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/actions/booking")>();
  return {
    ...original,
    submitBooking: testState.submitBooking,
  };
});

const projects = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: { en: "Beading", zh: "串珠" },
    durationMinutes: 30 as const,
    priceDisplay: "A$43",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: { en: "Paint clay figurine", zh: "彩绘黏土摆件" },
    durationMinutes: 60 as const,
    priceDisplay: "A$27.50",
  },
];

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("OrdinaryBookingForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.locale = "en";
    testState.selectedStatus = "available";
    testState.getOrdinaryAvailability.mockReset().mockResolvedValue([
      {
        date: "2030-08-12",
        startTime: "10:30",
        endTime: "11:30",
        status: "available",
        remaining: 6,
      },
    ]);
    testState.submitBooking.mockReset().mockResolvedValue({
      success: true,
      bookingId: "ordinary-1",
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function renderForm(
    options: {
      initialProjectId?: string;
      locale?: "en" | "zh";
      requestEnabled?: boolean;
    } = {},
  ) {
    testState.locale = options.locale ?? "en";
    await act(async () =>
      root.render(
        <OrdinaryBookingForm
          initialProjectId={options.initialProjectId}
          locale={options.locale ?? "en"}
          projects={projects}
          requestEnabled={options.requestEnabled ?? true}
        />,
      ),
    );
  }

  it("preselects a valid catalogue project for one participant and keeps it editable", async () => {
    await renderForm({ initialProjectId: projects[1].id });

    const initial = container.querySelector<HTMLInputElement>(
      '[aria-label="Paint clay figurine quantity"]',
    );
    const alternative = container.querySelector<HTMLInputElement>(
      '[aria-label="Beading quantity"]',
    );
    expect(initial?.value).toBe("1");
    expect(alternative?.value).toBe("0");
    expect(container.textContent).toContain("1 of 1 participants assigned");
    expect(container.querySelector('[data-testid="ordinary-calendar"]')).not.toBeNull();

    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(initial, "0");
    await act(async () => {
      initial?.dispatchEvent(new Event("input", { bubbles: true }));
      initial?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const refreshedAlternative = container.querySelector<HTMLInputElement>(
      '[aria-label="Beading quantity"]',
    );
    setter?.call(refreshedAlternative, "1");
    await act(async () => {
      refreshedAlternative?.dispatchEvent(new Event("input", { bubbles: true }));
      refreshedAlternative?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Paint clay figurine quantity"]',
      )?.value,
    ).toBe("0");
    expect(refreshedAlternative?.value).toBe("1");
  });

  it("ignores an unknown catalogue project instead of preselecting it", async () => {
    await renderForm({ initialProjectId: "unknown-project" });

    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Beading quantity"]',
      )?.value,
    ).toBe("0");
    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Paint clay figurine quantity"]',
      )?.value,
    ).toBe("0");
    expect(container.textContent).toContain("0 of 1 participants assigned");
    expect(container.querySelector('[data-testid="ordinary-calendar"]')).toBeNull();
  });

  function setInput(name: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`[name="${name}"]`);
    expect(input).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    input?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function completeForm({ selectSlot = true } = {}) {
    setInput("name", "Alice");
    setInput("phone", "0430000000");
    setInput("email", "alice@example.com");
    const projectQuantity =
      container.querySelector<HTMLInputElement>(
        '[aria-label="Beading quantity"]',
      ) ??
      container.querySelector<HTMLInputElement>('[aria-label="串珠数量"]');
    const quantitySetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    quantitySetter?.call(projectQuantity, "1");
    await act(async () => {
      projectQuantity?.dispatchEvent(new Event("input", { bubbles: true }));
      projectQuantity?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    if (selectSlot) {
      const slot = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button"),
      ).find((button) => button.textContent === "Choose generated test start");
      await act(async () => slot?.click());
    }
    const policy = container.querySelector<HTMLInputElement>(
      'input[name="policyAccepted"]',
    );
    await act(async () => policy?.click());
  }

  async function submit() {
    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await act(async () => {});
  }

  it("never bypasses the effective capability gate and shows canonical contact fallback", async () => {
    await renderForm({ requestEnabled: false });

    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain(
      "Online requests are not available yet",
    );
    expect(container.textContent).toContain(
      "G082/235 Springvale Rd, Glen Waverley VIC 3150",
    );
    expect(container.innerHTML).toContain('href="tel:0430787712"');
    expect(container.innerHTML).toContain(
      'href="mailto:congdongdong03@gmail.com"',
    );
    expect(container.textContent).toContain("95848743904");
  });

  it("refetches availability immediately before sending the exact selected request", async () => {
    await renderForm();
    await completeForm();
    await submit();

    expect(testState.getOrdinaryAvailability).toHaveBeenCalledWith({
      attendance: 1,
      date: "2030-08-12",
      durationMinutes: 30,
    });
    expect(testState.submitBooking).toHaveBeenCalledOnce();
    const formData = testState.submitBooking.mock.calls[0]?.[0] as FormData;
    expect(formData.get("mode")).toBe("booking");
    expect(formData.get("startTime")).toBe("10:30");
    expect(formData.get("participantCount")).toBe("1");
    expect(formData.get("items")).toBe(
      JSON.stringify([
        {
          projectId: "00000000-0000-4000-8000-000000000001",
          quantity: 1,
          decideInStore: false,
        },
      ]),
    );
    expect(formData.get("policyVersion")).toBe("2026-07-30");
    expect(container.textContent).toContain("awaits manual staff confirmation");
    expect(container.textContent).toContain("Pay in store");
    expect(container.textContent).not.toContain("Booking confirmed");
  });

  it("stops a stale available selection, refreshes the calendar, and does not submit", async () => {
    testState.getOrdinaryAvailability.mockResolvedValue([
      {
        date: "2030-08-12",
        startTime: "10:30",
        endTime: "11:30",
        status: "waitlist",
        remaining: 0,
      },
      {
        date: "2030-08-12",
        startTime: "11:00",
        endTime: "12:00",
        status: "available",
        remaining: 8,
      },
    ]);
    await renderForm();
    await completeForm();
    await submit();

    expect(testState.submitBooking).not.toHaveBeenCalled();
    expect(container.textContent).toContain("That time just changed");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it.each(["SLOT_FULL", "SLOT_IN_PAST", "STUDIO_CLOSED"])(
    "clears and refreshes a matched slot when POST returns %s",
    async (code) => {
      testState.submitBooking.mockResolvedValue({
        success: false,
        code,
        errors: {
          server: ["That time just changed. Review the available times."],
        },
      });
      await renderForm();
      await completeForm();
      await submit();

      expect(testState.getOrdinaryAvailability).toHaveBeenCalledOnce();
      expect(testState.submitBooking).toHaveBeenCalledOnce();
      const calendar = container.querySelector(
        '[data-testid="ordinary-calendar"]',
      );
      expect(calendar?.getAttribute("data-selected-start")).toBe("");
      expect(calendar?.getAttribute("data-refresh-key")).toBe("1");
      expect(container.textContent).toContain("That time just changed");
    },
  );

  it.each([
    [
      "en",
      "waitlist request was received",
      "awaits manual staff confirmation",
    ],
    ["zh", "候补申请已收到", "正在等待员工人工确认"],
  ] as const)(
    "submits a %s waitlist and truthfully reports pending manual confirmation",
    async (locale, receivedCopy, pendingCopy) => {
      testState.selectedStatus = "waitlist";
      testState.getOrdinaryAvailability.mockResolvedValue([
        {
          date: "2030-08-12",
          startTime: "10:30",
          endTime: "11:30",
          status: "waitlist",
          remaining: 0,
        },
      ]);
      await renderForm({ locale });
      await completeForm();
      await submit();

      const formData = testState.submitBooking.mock.calls[0]?.[0] as FormData;
      expect(formData.get("mode")).toBe("waitlist");
      expect(container.textContent).toContain(receivedCopy);
      expect(container.textContent).toContain(pendingCopy);
      expect(container.textContent).toContain("AUD");
      expect(container.textContent).toContain(
        "G082/235 Springvale Rd, Glen Waverley VIC 3150",
      );
      expect(container.innerHTML).toContain('href="tel:0430787712"');
      expect(container.innerHTML).toContain(
        'href="mailto:congdongdong03@gmail.com"',
      );
      expect(container.textContent).toContain("95848743904");
    },
  );

  it.each([
    ["en", "awaits manual staff confirmation", "Pay in store"],
    ["zh", "正在等待员工人工确认", "请到店付款"],
  ] as const)(
    "keeps canonical contact and payment details on %s booking success",
    async (locale, pendingCopy, paymentCopy) => {
      await renderForm({ locale });
      await completeForm();
      await submit();

      expect(container.textContent).toContain(pendingCopy);
      expect(container.textContent).toContain(paymentCopy);
      expect(container.textContent).toContain("AUD");
      expect(container.textContent).toContain(
        "G082/235 Springvale Rd, Glen Waverley VIC 3150",
      );
      expect(container.innerHTML).toContain('href="tel:0430787712"');
      expect(container.innerHTML).toContain(
        'href="mailto:congdongdong03@gmail.com"',
      );
      expect(container.textContent).toContain("95848743904");
    },
  );

  it("associates and focuses the schedule error when no start is selected", async () => {
    await renderForm();
    await completeForm({ selectSlot: false });
    await submit();

    const error = Array.from(
      container.querySelectorAll<HTMLElement>('[role="alert"]'),
    ).find((candidate) =>
      candidate.textContent?.includes("Choose an available or waitlist time"),
    );
    const calendar = container.querySelector(
      '[data-testid="ordinary-calendar"]',
    );
    expect(error?.id).toBeTruthy();
    expect(calendar?.getAttribute("aria-invalid")).toBe("true");
    expect(calendar?.getAttribute("aria-describedby")).toBe(error?.id);
    expect(document.activeElement?.textContent).toBe("Test date control");
  });

  it("retains one request-attempt object for retry and links returned field errors", async () => {
    testState.submitBooking
      .mockResolvedValueOnce({
        success: false,
        errors: {
          name: ["Name needs review"],
          server: ["Network response was lost"],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        bookingId: "ordinary-1",
      });
    await renderForm();
    await completeForm();
    await submit();

    const name = container.querySelector<HTMLInputElement>('[name="name"]');
    const errorId = name?.getAttribute("aria-describedby");
    expect(name?.getAttribute("aria-invalid")).toBe("true");
    expect(errorId).toBeTruthy();
    expect(container.querySelector(`#${errorId}`)?.textContent).toBe(
      "Name needs review",
    );

    await submit();
    expect(testState.submitBooking).toHaveBeenCalledTimes(2);
    expect(testState.submitBooking.mock.calls[0]?.[1]).toBe(
      testState.submitBooking.mock.calls[1]?.[1],
    );
  });

  it("presents equivalent Chinese policy, payment, pending, and contact wording", async () => {
    await renderForm({ locale: "zh" });

    expect(container.textContent).toContain("最低年龄为 5 岁");
    expect(container.textContent).toContain("5 至 8 岁");
    expect(container.textContent).toContain("至少提前两小时");
    expect(container.textContent).toContain("未来七个日历日");
    expect(container.textContent).toContain("最多 8 人");
    expect(container.textContent).toContain("迟到超过 20 分钟");
    expect(container.textContent).toContain("取消或改期");
    expect(container.textContent).toContain("所有价格均为澳元");
    expect(container.textContent).toContain("到店付款");
    expect(container.textContent).toContain("人工确认");
    expect(container.textContent).toContain("0430 787 712");
  });

  it("presents the age-five supervision policy in English", async () => {
    await renderForm();

    expect(container.textContent).toContain("Minimum age is 5");
    expect(container.textContent).toContain("Children aged 5–8");
  });
});
