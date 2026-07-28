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
  form.set("numberOfPeople", "8");
  form.set("partyPackageId", "00000000-0000-4000-8000-000000000003");
  form.set("timeSlotId", "00000000-0000-4000-8000-000000000004");
  form.set("preferredDate", "2030-08-12");
  form.set("locale", "zh");
  form.set("minPeople", "4");
  form.set("maxPeople", "12");
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
});

describe("submitPartyBooking", () => {
  it("submits authoritative package/slot IDs with required contact and people", async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({
          success: true,
          data: { id: "party-booking-1", status: "new" },
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
      timeSlotId: "00000000-0000-4000-8000-000000000004",
      preferredDate: "2030-08-12",
      numberOfPeople: 8,
      name: "Mei",
      phone: "0430000001",
      email: "mei@example.com",
      locale: "zh",
    });
  });

  it("validates the package range before transport with localized errors", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const form = validPartyFormData();
    form.set("numberOfPeople", "13");

    await expect(submitPartyBooking(form)).resolves.toMatchObject({
      success: false,
      errors: {
        numberOfPeople: ["派对人数须为 4 至 12 人"],
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
    invalidForm.set("numberOfPeople", "13");
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
    invalidForm.set("numberOfPeople", "13");
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
