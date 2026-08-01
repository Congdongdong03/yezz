import { EMAIL_DELIVERY_LABELS } from "./email-delivery";
import type { Booking, BookingStatus } from "./types";
import type { BookingWorkflowAction } from "./booking-status";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  new: "新预约",
  contacted: "已联系",
  confirmed: "已确认",
  cancelled: "已取消",
  pending_review: "待审核",
  waitlisted: "候补中",
  rejected: "已拒绝",
  time_proposed: "已提议时段",
  awaiting_in_store_payment: "等待到店支付",
  confirmed_paid: "已付场地费",
  payment_expired: "付款期限已过",
  reschedule_requested: "申请改期",
  cancellation_requested: "申请取消",
  refunded: "已退款",
  no_show: "未到店",
  completed: "已完成",
};

export const BOOKING_ACTION_LABELS: Record<BookingWorkflowAction, string> = {
  confirm: "确认",
  waitlist: "转候补",
  reject: "拒绝",
  propose_time: "提出时段",
  accept_time: "接受时段",
  record_payment: "记录场地费",
  add_charge: "记录费用",
  cancel: "取消",
  refund: "记录退款",
  complete: "完成",
  no_show: "未到店",
};

export function formatBookingQueueDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBookingQueueAttendance(booking: Booking): string {
  if (!booking.attendance) {
    return booking.numberOfPeople == null ? "—" : `${booking.numberOfPeople} 人`;
  }
  const { participantCount, accompanyingAdultCount, totalCount } =
    booking.attendance;
  if (booking.kind === "party") {
    return `${participantCount} 位参与者${
      accompanyingAdultCount == null
        ? ""
        : `，${accompanyingAdultCount} 位家长`
    }（共 ${totalCount} 人）`;
  }
  const children = booking.attendance.youngChildCount;
  return `${participantCount} 位制作${children ? `，${children} 名儿童` : ""}${
    accompanyingAdultCount ? `，${accompanyingAdultCount} 位陪同` : ""
  }（共 ${totalCount} 人）`;
}

export function getBookingQueueOfferingName(booking: Booking): string {
  return (
    booking.offering?.name?.zh?.trim() ||
    booking.offering?.name?.en?.trim() ||
    booking.interestedProject?.trim() ||
    "资料不完整"
  );
}

export function getBookingQueueDeliverySummary(
  booking: Booking,
): { label: string; failureLabel?: string } {
  const latestStatus = booking.notificationSummary.latestStatus;
  const label = latestStatus
    ? EMAIL_DELIVERY_LABELS[latestStatus]
    : booking.email
      ? "尚无邮件"
      : "无邮箱，需电话联系";
  return {
    label,
    ...(booking.notificationSummary.failedCount > 0
      ? {
          failureLabel: `${booking.notificationSummary.failedCount} 封发送失败`,
        }
      : {}),
  };
}
