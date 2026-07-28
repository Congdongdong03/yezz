import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestAttempt } from "../requests/idempotency";
import { submitCart } from "./cart";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function validFormData() {
  const form = new FormData();
  form.set("name", "Alice");
  form.set("phone", "0430000000");
  form.set("email", "alice@example.com");
  form.set("timeSlotId", "00000000-0000-4000-8000-000000000002");
  form.set("numberOfPeople", "2");
  form.set("preferredDate", "2030-08-12");
  form.set("locale", "en");
  form.set("items", JSON.stringify([
    {
      projectId: "00000000-0000-4000-8000-000000000001",
      styleId: "00000000-0000-4000-8000-000000000003",
      projectName: { en: "Phone case", zh: "手机壳" },
      projectType: "product",
      price: "$0 spoof",
    },
  ]));
  return form;
}

describe("submitCart", () => {
  it("submits only catalogue IDs with one authoritative slot and people count", async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({
          success: true,
          data: { id: "order-1", status: "new", replayed: false },
        });
      },
    );
    vi.stubGlobal("fetch", request);

    await expect(submitCart(validFormData())).resolves.toMatchObject({
      success: true,
      orderId: "order-1",
    });

    const body = JSON.parse(
      String((request.mock.calls[0]?.[1] as RequestInit).body),
    ) as Record<string, unknown>;
    expect(body).toMatchObject({
      email: "alice@example.com",
      timeSlotId: "00000000-0000-4000-8000-000000000002",
      numberOfPeople: 2,
      preferredDate: "2030-08-12",
      locale: "en",
      items: [
        {
          projectId: "00000000-0000-4000-8000-000000000001",
          styleId: "00000000-0000-4000-8000-000000000003",
        },
      ],
    });
    expect(body).not.toHaveProperty("items.0.projectName");
    expect(body).not.toHaveProperty("items.0.projectType");
    expect(body).not.toHaveProperty("items.0.price");
  });

  it("reuses one attempt key after server failure and rotates after success", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            success: false,
            error: { code: "TEMPORARY", message: "Please retry" },
          },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: { id: "order-1", status: "new", replayed: true },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: { id: "order-2", status: "new", replayed: false },
        }),
      );
    vi.stubGlobal("fetch", request);
    const generate = vi
      .fn<() => string>()
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000010")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000011")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000012");
    const attempt = createRequestAttempt(generate);

    await expect(submitCart(validFormData(), attempt)).resolves.toMatchObject({
      success: false,
    });
    await expect(submitCart(validFormData(), attempt)).resolves.toMatchObject({
      success: true,
      orderId: "order-1",
    });
    await expect(submitCart(validFormData(), attempt)).resolves.toMatchObject({
      success: true,
      orderId: "order-2",
    });

    const keys = request.mock.calls.map(([, init]) =>
      new Headers((init as RequestInit).headers).get("Idempotency-Key"),
    );
    expect(keys).toEqual([
      "00000000-0000-4000-8000-000000000010",
      "00000000-0000-4000-8000-000000000010",
      "00000000-0000-4000-8000-000000000011",
    ]);
  });

  it("does not rotate the attempt key after client validation failure", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const attempt = createRequestAttempt(
      () => "00000000-0000-4000-8000-000000000020",
    );
    const invalid = validFormData();
    invalid.delete("name");

    await expect(submitCart(invalid, attempt)).resolves.toMatchObject({
      success: false,
    });
    expect(attempt.current()).toBe(
      "00000000-0000-4000-8000-000000000020",
    );
    expect(request).not.toHaveBeenCalled();
  });
});
