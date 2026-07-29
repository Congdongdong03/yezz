import type { BookingStatus, OrderStatus } from "./types";
import { ApiClientError } from "../api/base";

export function requiresCustomerNote(status: OrderStatus) {
  return status === "confirmed" || status === "cancelled";
}

export function isStaleBookingStatus(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.code === "STATUS_CONFLICT" || error.code === "STALE_STATUS")
  );
}

export function formatBookingActionError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "STATUS_CONFLICT" || error.code === "STALE_STATUS") {
      return "记录已被其他操作更新，请查看最新状态";
    }
    if (error.code === "INVALID_TRANSITION") {
      return "不能进行此状态变更，请刷新后重试";
    }
    if (error.code === "OPERATION_ID_CONFLICT") {
      return "本次操作已被其他状态变更使用，请关闭窗口后重试";
    }
  }
  return "状态更新失败，请稍后重试";
}

export type BookingWorkflowAction =
  | "confirm"
  | "waitlist"
  | "reject"
  | "propose_time"
  | "accept_time"
  | "record_payment"
  | "add_charge"
  | "cancel"
  | "refund"
  | "complete"
  | "no_show";

export function bookingActionsFor(
  kind: "experience" | "party",
  status: BookingStatus,
): BookingWorkflowAction[] {
  if (kind === "party") {
    const partyActions: Partial<
      Record<BookingStatus, BookingWorkflowAction[]>
    > = {
      pending_review: ["propose_time", "reject", "cancel"],
      time_proposed: ["accept_time", "cancel"],
      awaiting_in_store_payment: ["record_payment", "cancel"],
      confirmed_paid: ["add_charge", "complete", "no_show", "cancel"],
      cancellation_requested: ["cancel"],
      cancelled: ["refund"],
    };
    return partyActions[status] ?? [];
  }
  const ordinaryActions: Partial<
    Record<BookingStatus, BookingWorkflowAction[]>
  > = {
    new: ["confirm", "cancel"],
    contacted: ["confirm", "cancel"],
    pending_review: ["confirm", "waitlist", "reject"],
    waitlisted: ["confirm", "cancel"],
    reschedule_requested: ["confirm", "cancel"],
    cancellation_requested: ["cancel"],
    confirmed: ["complete", "no_show", "cancel"],
  };
  return ordinaryActions[status] ?? [];
}

export function melbourneLocalToIso(value: string): string {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error("Melbourne timestamp must use YYYY-MM-DDTHH:MM");
  const [, year, month, day, hour, minute] = match;
  const targetUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let instant = new Date(targetUtc);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(instant)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    const observedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    const delta = targetUtc - observedUtc;
    if (delta === 0) return instant.toISOString();
    instant = new Date(instant.getTime() + delta);
  }
  throw new Error("Melbourne timestamp could not be resolved");
}

export function isStaleOrderStatus(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "STATUS_CONFLICT";
}

export function formatOrderActionError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "STATUS_CONFLICT") {
      return "产品预约状态已变化，列表已刷新，请重新选择操作";
    }
    if (error.code === "INVALID_TRANSITION") {
      return "不能进行此状态变更，请刷新后重试";
    }
    if (error.code === "OPERATION_ID_CONFLICT") {
      return "本次操作已被其他状态变更使用，请关闭窗口后重试";
    }
  }
  return "状态更新失败，请稍后重试";
}
