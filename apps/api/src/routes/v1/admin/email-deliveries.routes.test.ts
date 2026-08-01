import { describe, expect, it } from "vitest";
import {
  parseEmailDeliveryPagination,
  safeEmailDelivery,
} from "./email-deliveries.routes.js";

describe("email delivery pagination", () => {
  it.each(["1.5", "Infinity", "-1", "0", "not-a-number"])(
    "rejects invalid page value %s",
    (value) => {
      expect(() => parseEmailDeliveryPagination(value, 1)).toThrowError(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
    },
  );

  it("caps a valid integer limit at 100", () => {
    expect(parseEmailDeliveryPagination("250", 25, 100)).toBe(100);
  });

  it("never returns setup tokens embedded in durable outbox payloads", () => {
    const token = "A".repeat(43);
    const safe = safeEmailDelivery({
      id: "delivery-1",
      messageType: "admin_password_setup",
      payload: {
        template: "admin_password_setup",
        sealedSetupToken: `v1.${"a".repeat(16)}.${"b".repeat(58)}.${"c".repeat(22)}`,
      },
    } as never);

    expect(safe).toEqual({
      id: "delivery-1",
      messageType: "admin_password_setup",
    });
    expect(JSON.stringify(safe)).not.toContain(token);
  });
});
