import type { EmailDeliveryStatus, EmailDeliveryListOptions } from "./types";

export const EMAIL_DELIVERY_LABELS: Record<EmailDeliveryStatus, string> = {
  pending: "等待发送",
  processing: "发送中",
  sent: "已发送",
  failed: "发送失败",
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

export function formatSafeDeliveryError(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 300);
}
