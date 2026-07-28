import type { OrderStatus } from "./types";
import { ApiClientError } from "../api/base";

export function requiresCustomerNote(status: OrderStatus) {
  return status === "confirmed" || status === "cancelled";
}

export function formatBookingActionError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "STATUS_CONFLICT") {
      return "预约状态已变化，请刷新后重试";
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
