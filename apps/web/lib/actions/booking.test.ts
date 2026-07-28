import { afterEach, describe, expect, it, vi } from "vitest";
import { createBookingAttempt, submitBooking } from "./booking";

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

    await expect(submitBooking(validFormData(), attempt)).resolves.toMatchObject({
      success: false,
    });
    expect(attempt.current()).toBe(originalKey);

    await expect(submitBooking(validFormData(), attempt)).resolves.toMatchObject({
      success: true,
      bookingId: "booking-1",
    });
    expect(attempt.current()).not.toBe(originalKey);

    const nextAttemptKey = attempt.current();
    await submitBooking(validFormData(), attempt);
    const keys = request.mock.calls.map(
      ([, init]) => new Headers((init as RequestInit).headers).get("Idempotency-Key"),
    );
    expect(keys[0]).toBe(originalKey);
    expect(keys[1]).toBe(originalKey);
    expect(keys[2]).toBe(nextAttemptKey);
  });
});
