import { describe, expect, it } from "vitest";
import { parseEmailDeliveryPagination } from "./email-deliveries.routes.js";

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
});
