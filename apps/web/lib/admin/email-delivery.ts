import type { EmailDeliveryStatus, EmailDeliveryListOptions } from "./types";

export const EMAIL_DELIVERY_LABELS: Record<EmailDeliveryStatus, string> = {
  pending: "等待发送",
  processing: "发送中",
  sent: "已发送",
  failed: "发送失败",
};

export const EMAIL_MESSAGE_TYPE_LABELS: Record<string, string> = {
  booking_received_customer: "预约已收到（客户）",
  booking_received_owner: "新预约通知（店主）",
  cart_order_received_customer: "订单已收到（客户）",
  cart_order_received_owner: "新订单通知（店主）",
  booking_status_customer: "预约状态更新（客户）",
  cart_order_status_customer: "订单状态更新（客户）",
};

export function buildEmailDeliveryQuery(
  options: EmailDeliveryListOptions,
): string {
  const query = new URLSearchParams();
  query.set("page", String(Math.max(1, options.page ?? 1)));
  query.set("limit", String(Math.min(100, Math.max(1, options.limit ?? 25))));
  if (options.status) query.set("status", options.status);
  return query.toString();
}

export function formatDeliveryErrorForAdmin(value: string | null): string {
  if (!value) return "—";
  if (
    value.includes("INVALID_EMAIL_PAYLOAD") ||
    value.includes("invalid_template_payload")
  ) {
    return "邮件内容无效，请联系技术人员";
  }
  if (value.includes("provider_not_configured")) {
    return "邮件服务尚未配置";
  }
  if (
    value.includes("invalid_to_address") ||
    value.includes("recipient rejected")
  ) {
    return "收件邮箱地址无效";
  }
  if (value.startsWith("429 ")) {
    return "邮件服务繁忙，系统将自动重试";
  }
  return "发送失败，请重试或联系技术人员";
}
