import { describe, expect, it } from "vitest";
import {
  EMAIL_DELIVERY_LABELS,
  EMAIL_MESSAGE_TYPE_LABELS,
  buildEmailDeliveryQuery,
  formatEmailDeliveryActionError,
  formatDeliveryErrorForAdmin,
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
    expect(
      formatDeliveryErrorForAdmin(
        "422 INVALID_EMAIL_PAYLOAD: invalid_template_payload",
      ),
    ).toBe("邮件内容无效，请联系技术人员");
    expect(
      formatDeliveryErrorForAdmin(
        "503 provider_not_configured: RESEND_API_KEY is not configured",
      ),
    ).toBe("邮件服务尚未配置");
    expect(formatDeliveryErrorForAdmin(null)).toBe("—");
  });

  it("presents machine message types in Chinese", () => {
    expect(EMAIL_MESSAGE_TYPE_LABELS.booking_received_customer).toBe(
      "预约已收到（客户）",
    );
    expect(EMAIL_MESSAGE_TYPE_LABELS.cart_order_status_customer).toBe(
      "订单状态更新（客户）",
    );
  });

  it("never exposes raw English load or retry errors to the Chinese admin page", () => {
    const rawError = new Error(
      "Failed to fetch: upstream connection refused for customer@example.test",
    );

    expect(formatEmailDeliveryActionError("load", rawError)).toBe(
      "邮件记录加载失败，请稍后重试",
    );
    expect(formatEmailDeliveryActionError("retry", rawError)).toBe(
      "重新发送失败，请稍后重试",
    );
    expect(
      formatEmailDeliveryActionError("load", "raw server message"),
    ).not.toContain("raw server message");
  });
});
