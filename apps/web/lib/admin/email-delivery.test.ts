import { describe, expect, it } from "vitest";
import {
  EMAIL_DELIVERY_LABELS,
  buildEmailDeliveryQuery,
  formatSafeDeliveryError,
} from "./email-delivery";

describe("email delivery admin presentation", () => {
  it("uses the required Chinese status labels", () => {
    expect(EMAIL_DELIVERY_LABELS).toEqual({
      pending: "等待发送",
      processing: "发送中",
      sent: "已发送",
      failed: "发送失败",
    });
  });

  it("builds a bounded paginated status query", () => {
    expect(
      buildEmailDeliveryQuery({ page: 3, limit: 200, status: "failed" }),
    ).toBe("page=3&limit=100&status=failed");
  });

  it("does not render more than 300 safe error characters", () => {
    expect(formatSafeDeliveryError("x".repeat(400))).toHaveLength(300);
    expect(formatSafeDeliveryError(null)).toBe("—");
  });
});
