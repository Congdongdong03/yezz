import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBookingAttempt,
  submitBooking,
  submitPartyBooking,
} from "./booking";
import type { RequestAttempt } from "../requests/idempotency";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function validFormData() {
  const form = new FormData();
  form.set("name", "Alice");
  form.set("phone", "0430000000");
  form.set("email", "alice@example.com");
  form.set("numberOfPeople", "2");
  form.set("projectId", "00000000-0000-4000-8000-000000000001");
  form.set("timeSlotId", "00000000-0000-4000-8000-000000000002");
  form.set("preferredDate", "2030-08-12");
  form.set("interestedProject", "Spoofed display label");
  form.set("locale", "en");
  return form;
}

function validPartyFormData() {
  const form = new FormData();
  form.set("name", "Mei");
  form.set("phone", "0430000001");
  form.set("email", "mei@example.com");
  form.set("partyPackageId", "00000000-0000-4000-8000-000000000003");
  form.set("birthdayChildName", "Lina");
  form.set("birthdayChildAge", "7");
  form.set("participantCount", "8");
  form.set("parentCount", "2");
  form.set("desiredDate", "2030-08-12");
  form.set("desiredStartTime", "12:00");
  form.set(
    "projectInterests",
    JSON.stringify(["Air-dry cream piping", "Melty bead craft"]),
  );
  form.set("byoCake", "true");
  form.set("byoDrinks", "false");
  form.set("byoFood", "true");
  form.set("byoSnacks", "false");
  form.set("cakeCuttingRequested", "true");
  form.set("specialRequirements", "Window table");
  form.set("locale", "zh");
  form.set("policyVersion", "2026-07-30");
  form.set("policyAccepted", "true");
  return form;
}

function validOrdinaryFormData() {
  const form = new FormData();
  form.set("mode", "booking");
  form.set("name", "Alice");
  form.set("phone", "0430000000");
  form.set("email", "alice@example.com");
  form.set("date", "2030-08-12");
  form.set("startTime", "10:30");
  form.set("participantCount", "2");
  form.set("youngChildCount", "1");
  form.set("accompanyingAdultCount", "1");
  form.set(
    "items",
    JSON.stringify([
      {
        projectId: "00000000-0000-4000-8000-000000000001",
        quantity: 1,
        decideInStore: false,
      },
      { quantity: 1, decideInStore: true },
    ]),
  );
  form.set("message", "Window seat if possible");
  form.set("locale", "en");
  form.set("policyVersion", "2026-07-30");
  form.set("policyAccepted", "true");
  return form;
}

describe("submitBooking", () => {
  it("submits the authoritative project/slot IDs and required contact fields", async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({
          success: true,
          data: { id: "booking-1", status: "new" },
        });
      },
    );
    vi.stubGlobal("fetch", request);

    await expect(submitBooking(validFormData())).resolves.toMatchObject({
      success: true,
      bookingId: "booking-1",
    });
    const body = JSON.parse(
      String((request.mock.calls[0]?.[1] as RequestInit).body),
    ) as Record<string, unknown>;
    expect(body).toMatchObject({
      kind: "experience",
      projectId: "00000000-0000-4000-8000-000000000001",
      timeSlotId: "00000000-0000-4000-8000-000000000002",
      email: "alice@example.com",
      numberOfPeople: 2,
    });
    expect(body.interestedProject).toBe("Spoofed display label");
  });

  it("rejects a display label without an authoritative project ID", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const form = validFormData();
    form.delete("projectId");

    await expect(submitBooking(form)).resolves.toMatchObject({
      success: false,
      errors: {
        projectId: ["Please choose an experience again"],
      },
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("requires email and a positive people count before transport", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const form = validFormData();
    form.delete("email");
    form.set("numberOfPeople", "0");

    await expect(submitBooking(form)).resolves.toMatchObject({
      success: false,
      errors: {
        email: ["Email is required"],
        numberOfPeople: ["People must be at least 1"],
      },
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("retains one attempt key across failure and rotates only after confirmed success", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: { id: "booking-1", status: "new" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: { id: "booking-2", status: "new" },
        }),
      );
    vi.stubGlobal("fetch", request);
    const attempt = createBookingAttempt();
    const originalKey = attempt.current();

    await expect(
      submitBooking(validFormData(), attempt),
    ).resolves.toMatchObject({
      success: false,
    });
    expect(attempt.current()).toBe(originalKey);

    await expect(
      submitBooking(validFormData(), attempt),
    ).resolves.toMatchObject({
      success: true,
      bookingId: "booking-1",
    });
    expect(attempt.current()).not.toBe(originalKey);

    const nextAttemptKey = attempt.current();
    await submitBooking(validFormData(), attempt);
    const keys = request.mock.calls.map(([, init]) =>
      new Headers((init as RequestInit).headers).get("Idempotency-Key"),
    );
    expect(keys[0]).toBe(originalKey);
    expect(keys[1]).toBe(originalKey);
    expect(keys[2]).toBe(nextAttemptKey);
  });

  it("submits the exact ordinary booking request body and mode", async () => {
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Response.json({
          success: true,
          data: { id: "ordinary-1", status: "pending_review" },
        });
      },
    );
    vi.stubGlobal("fetch", request);

    await expect(submitBooking(validOrdinaryFormData())).resolves.toMatchObject({
      success: true,
      bookingId: "ordinary-1",
    });

    const body = JSON.parse(
      String((request.mock.calls[0]?.[1] as RequestInit).body),
    );
    expect(body).toEqual({
      kind: "experience",
      mode: "booking",
      name: "Alice",
      phone: "0430000000",
      email: "alice@example.com",
      date: "2030-08-12",
      startTime: "10:30",
      participantCount: 2,
      youngChildCount: 1,
      accompanyingAdultCount: 1,
      items: [
        {
          projectId: "00000000-0000-4000-8000-000000000001",
          quantity: 1,
          decideInStore: false,
        },
        { quantity: 1, decideInStore: true },
      ],
      message: "Window seat if possible",
      locale: "en",
      policyVersion: "2026-07-30",
      policyAccepted: true,
    });
  });

  it("rejects an outdated ordinary policy acceptance before transport", async () => {
    const request = vi.fn(async () =>
      Response.json({ success: true, data: { id: "ordinary-1" } }),
    );
    vi.stubGlobal("fetch", request);
    const form = validOrdinaryFormData();
    form.set("policyVersion", "2026-07-29");

    await expect(submitBooking(form)).resolves.toMatchObject({
      success: false,
      errors: { policyVersion: expect.any(Array) },
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("validates ordinary attendance, supervision, item parity, and policy before transport", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const form = validOrdinaryFormData();
    form.set("participantCount", "7");
    form.set("youngChildCount", "1");
    form.set("accompanyingAdultCount", "2");
    form.set(
      "items",
      JSON.stringify([
        {
          projectId: "00000000-0000-4000-8000-000000000001",
          quantity: 1,
          decideInStore: false,
        },
      ]),
    );
    form.set("policyAccepted", "false");

    await expect(submitBooking(form)).resolves.toMatchObject({
      success: false,
      errors: {
        accompanyingAdultCount: ["Physical attendance cannot exceed 8 people"],
        items: ["Choose exactly one project for each DIY participant"],
        policyAccepted: ["Accept the booking policies to continue"],
      },
    });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ["en", "An accompanying adult is required for a child aged 5–8"],
    ["zh", "有 5 至 8 岁儿童参加时，至少需要一位陪同成人"],
  ] as const)(
    "uses the age-five supervision validation in %s",
    async (locale, expectedMessage) => {
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      const form = validOrdinaryFormData();
      form.set("locale", locale);
      form.set("youngChildCount", "1");
      form.set("accompanyingAdultCount", "0");

      await expect(submitBooking(form)).resolves.toMatchObject({
        success: false,
        errors: {
          accompanyingAdultCount: [expectedMessage],
        },
      });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("localizes authoritative stale-slot errors and retains the attempt key", async () => {
    const request = vi.fn(async () =>
      Response.json(
        {
          success: false,
          error: {
            code: "SLOT_FULL",
            message: "Internal English should not leak",
          },
        },
        { status: 409 },
      ),
    );
    vi.stubGlobal("fetch", request);
    const form = validOrdinaryFormData();
    form.set("locale", "zh");
    const attempt = createBookingAttempt();
    const key = attempt.current();

    await expect(submitBooking(form, attempt)).resolves.toMatchObject({
      success: false,
      code: "SLOT_FULL",
      errors: {
        server: ["该时段刚刚发生变化，请重新查看可用或候补时段。"],
      },
    });
    expect(attempt.current()).toBe(key);
  });

  it("retains an ordinary request key across network retry and rotates it only after success", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: { id: "ordinary-1", status: "pending_review" },
        }),
      );
    vi.stubGlobal("fetch", request);
    const attempt = createBookingAttempt();
    const originalKey = attempt.current();

    await expect(
      submitBooking(validOrdinaryFormData(), attempt),
    ).resolves.toMatchObject({ success: false });
    expect(attempt.current()).toBe(originalKey);

    await expect(
      submitBooking(validOrdinaryFormData(), attempt),
    ).resolves.toMatchObject({
      success: true,
      bookingId: "ordinary-1",
    });
    expect(attempt.current()).not.toBe(originalKey);
    expect(
      request.mock.calls.map(([, init]) =>
        new Headers((init as RequestInit).headers).get("Idempotency-Key"),
      ),
    ).toEqual([originalKey, originalKey]);
  });
});

describe("submitPartyBooking", () => {
  it("submits the exact request-only Task 6 party body", async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({
          success: true,
          data: { id: "party-booking-1", status: "pending_review" },
        });
      },
    );
    vi.stubGlobal("fetch", request);

    await expect(
      submitPartyBooking(validPartyFormData()),
    ).resolves.toMatchObject({
      success: true,
      bookingId: "party-booking-1",
    });

    const body = JSON.parse(
      String((request.mock.calls[0]?.[1] as RequestInit).body),
    ) as Record<string, unknown>;
    expect(body).toEqual({
      kind: "party",
      partyPackageId: "00000000-0000-4000-8000-000000000003",
      name: "Mei",
      phone: "0430000001",
      email: "mei@example.com",
      birthdayChildName: "Lina",
      birthdayChildAge: 7,
      participantCount: 8,
      parentCount: 2,
      desiredDate: "2030-08-12",
      desiredStartTime: "12:00",
      projectInterests: ["Air-dry cream piping", "Melty bead craft"],
      byoCake: true,
      byoDrinks: false,
      byoFood: true,
      byoSnacks: false,
      cakeCuttingRequested: true,
      specialRequirements: "Window table",
      locale: "zh",
      policyVersion: "2026-07-30",
      policyAccepted: true,
    });
  });

  it("rejects an outdated party policy acceptance before transport", async () => {
    const request = vi.fn(async () =>
      Response.json({ success: true, data: { id: "party-booking-1" } }),
    );
    vi.stubGlobal("fetch", request);
    const form = validPartyFormData();
    form.set("policyVersion", "2026-07-29");

    await expect(submitPartyBooking(form)).resolves.toMatchObject({
      success: false,
      errors: { policyVersion: expect.any(Array) },
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("validates attendance, parents, birthday age, projects, and policy before transport", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const form = validPartyFormData();
    form.set("participantCount", "3");
    form.set("parentCount", "0");
    form.set("birthdayChildAge", "4");
    form.set("projectInterests", "[]");
    form.set("policyAccepted", "false");

    await expect(submitPartyBooking(form)).resolves.toMatchObject({
      success: false,
      errors: {
        participantCount: ["手作参与者须为 4 至 8 人"],
        parentCount: ["须有 1 或 2 位陪同家长"],
        birthdayChildAge: ["生日小朋友须年满 5 岁"],
        projectInterests: ["请至少选择一个手作项目"],
        policyAccepted: ["请接受派对预约政策后继续"],
      },
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("uses the shared attempt lifecycle for validation, API, network, and success outcomes", async () => {
    const attempt: RequestAttempt = {
      current: vi.fn(() => "00000000-0000-4000-8000-000000000099"),
      failed: vi.fn(),
      succeeded: vi.fn(),
    };
    const invalidForm = validPartyFormData();
    invalidForm.set("participantCount", "3");
    await submitPartyBooking(invalidForm, attempt);
    expect(attempt.failed).toHaveBeenCalledTimes(1);
    expect(attempt.current).not.toHaveBeenCalled();

    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          success: false,
          error: { code: "SLOT_FULL", message: "Slot full" },
        }),
      )
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: { id: "party-booking-1", status: "new" },
        }),
      );
    vi.stubGlobal("fetch", request);

    await submitPartyBooking(validPartyFormData(), attempt);
    await submitPartyBooking(validPartyFormData(), attempt);
    expect(attempt.failed).toHaveBeenCalledTimes(3);
    expect(attempt.succeeded).not.toHaveBeenCalled();

    await submitPartyBooking(validPartyFormData(), attempt);
    expect(attempt.current).toHaveBeenCalledTimes(3);
    expect(attempt.succeeded).toHaveBeenCalledOnce();
  });

  it("retains the party key across all failures and rotates only after confirmed success", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          success: false,
          error: { code: "SLOT_FULL", message: "Slot full" },
        }),
      )
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: { id: "party-booking-1", status: "new" },
        }),
      );
    vi.stubGlobal("fetch", request);
    const attempt = createBookingAttempt();
    const originalKey = attempt.current();

    const invalidForm = validPartyFormData();
    invalidForm.set("participantCount", "3");
    await submitPartyBooking(invalidForm, attempt);
    expect(attempt.current()).toBe(originalKey);

    await expect(
      submitPartyBooking(validPartyFormData(), attempt),
    ).resolves.toMatchObject({ success: false });
    expect(attempt.current()).toBe(originalKey);

    await expect(
      submitPartyBooking(validPartyFormData(), attempt),
    ).resolves.toMatchObject({ success: false });
    expect(attempt.current()).toBe(originalKey);

    await expect(
      submitPartyBooking(validPartyFormData(), attempt),
    ).resolves.toMatchObject({
      success: true,
      bookingId: "party-booking-1",
    });
    expect(attempt.current()).not.toBe(originalKey);
    expect(
      request.mock.calls.map(([, init]) =>
        new Headers((init as RequestInit).headers).get("Idempotency-Key"),
      ),
    ).toEqual([originalKey, originalKey, originalKey]);
  });
});
