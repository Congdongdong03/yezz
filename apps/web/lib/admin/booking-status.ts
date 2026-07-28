import type { OrderStatus } from "./types";
import { ApiClientError } from "../api/base";

export function requiresCustomerNote(status: OrderStatus) {
  return status === "confirmed" || status === "cancelled";
}

export function isStaleBookingStatus(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "STATUS_CONFLICT";
}

export function formatBookingActionError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "STATUS_CONFLICT") {
      return "预约状态已变化，列表已刷新，请重新选择操作";
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
