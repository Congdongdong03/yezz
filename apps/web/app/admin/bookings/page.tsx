"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AlertBanner from "@/components/admin/AlertBanner";
import BookingStatusDialog, {
  type BookingStatusDialogResult,
} from "@/components/admin/BookingStatusDialog";
import {
  getAdminBookings,
  markNotificationsRead,
  updateBookingStatus,
} from "@/lib/admin/api";
import type { Booking, OrderStatus } from "@/lib/admin/types";
import {
  formatBookingActionError,
  isStaleBookingStatus,
} from "@/lib/admin/booking-status";
import { EMAIL_DELIVERY_LABELS } from "@/lib/admin/email-delivery";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "新预约",
  contacted: "已联系",
  confirmed: "已确认",
  cancelled: "已取消",
};

const STATUS_TARGETS: Record<OrderStatus, OrderStatus[]> = {
  new: ["contacted", "confirmed", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminBookingsPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusBookingAfterRefreshRef = useRef<string | null>(null);
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    id: string;
    status: OrderStatus;
    expectedStatus: OrderStatus;
  } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const load = async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const result = await getAdminBookings();
      setItems(
        "data" in result ? result.data : (result as unknown as Booking[]),
      );
      return true;
    } catch {
      setMessage({ type: "error", text: "预约记录加载失败，请稍后重试" });
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => load());
    markNotificationsRead("bookings").catch(() => {});
  }, []);

  useEffect(() => {
    const bookingId = focusBookingAfterRefreshRef.current;
    if (!bookingId) return;
    const statusControl = Array.from(
      document.querySelectorAll<HTMLSelectElement>(
        "select[data-booking-id]",
      ),
    ).find((control) => control.dataset.bookingId === bookingId);
    const target =
      statusControl?.isConnected && !statusControl.disabled
        ? statusControl
        : headingRef.current?.isConnected
          ? headingRef.current
          : null;
    if (!target || (statusControl?.isConnected && statusControl.disabled)) {
      return;
    }
    target.focus();
    if (document.activeElement === target) {
      focusBookingAfterRefreshRef.current = null;
    }
  }, [items, updatingId]);

  const handleStatusChange = async (
    id: string,
    result: BookingStatusDialogResult,
  ) => {
    setUpdatingId(id);
    try {
      const updated = await updateBookingStatus(id, result);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setMessage({ type: "success", text: "状态已更新" });
    } catch (err) {
      const stale = isStaleBookingStatus(err);
      const localized = formatBookingActionError(err);
      setMessage({
        type: "error",
        text: localized,
      });
      if (stale) {
        focusBookingAfterRefreshRef.current = id;
        setPendingStatusChange(null);
        await load({ showLoading: false });
      }
      return localized;
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRequestedStatusChange = (id: string, status: OrderStatus) => {
    const booking = items.find((item) => item.id === id);
    if (!booking || booking.status === status) return;
    setPendingStatusChange({
      id,
      status,
      expectedStatus: booking.status,
    });
  };

  const handleDialogConfirm = async (result: BookingStatusDialogResult) => {
    if (!pendingStatusChange) return;
    const error = await handleStatusChange(pendingStatusChange.id, result);
    if (!error) setPendingStatusChange(null);
    return error;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="font-serif text-2xl font-semibold text-warm-charcoal"
          ref={headingRef}
          tabIndex={-1}
        >
          预约管理
        </h1>
        <p className="text-sm text-muted-foreground">查看官网预约表单提交记录</p>
      </div>

      {message && (
        <AlertBanner
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无预约记录</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">提交时间</th>
                <th className="px-4 py-3 font-medium">姓名</th>
                <th className="px-4 py-3 font-medium">电话</th>
                <th className="px-4 py-3 font-medium">预约内容</th>
                <th className="px-4 py-3 font-medium">预约时段</th>
                <th className="px-4 py-3 font-medium">人数</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">邮件</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((booking) => (
                <tr key={booking.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(booking.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium">{booking.name}</td>
                  <td className="px-4 py-3">
                    <a className="hover:underline" href={`tel:${booking.phone}`}>
                      {booking.phone}
                    </a>
                    {booking.wechat && (
                      <div className="text-xs text-muted-foreground">微信: {booking.wechat}</div>
                    )}
                    {booking.email && (
                      <a
                        className="block text-xs text-muted-foreground hover:underline"
                        href={`mailto:${booking.email}`}
                      >
                        {booking.email}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        booking.kind === "party"
                          ? "bg-soft-pink/30 text-warm-charcoal"
                          : "bg-sage/20 text-warm-charcoal"
                      }`}
                    >
                      {booking.kind === "party" ? "聚会预约" : "体验预约"}
                    </span>
                    <span className="font-medium">
                      <span className="block">
                      {booking.offering?.name?.zh ??
                        booking.offering?.name?.en ??
                        booking.interestedProject ??
                        "资料不完整"}
                      </span>
                    </span>
                    {booking.offering?.price && (
                      <span className="block text-xs text-muted-foreground">
                        {booking.offering.price}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {booking.slot ? (
                      <>
                        <span>{booking.slot.date}</span>
                        <span className="block text-xs text-muted-foreground">
                          {booking.slot.startTime && booking.slot.endTime
                            ? `${booking.slot.startTime}–${booking.slot.endTime}`
                            : "历史记录无具体时间"}
                        </span>
                      </>
                    ) : (
                      "资料不完整"
                    )}
                  </td>
                  <td className="px-4 py-3">{booking.numberOfPeople ?? "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`更新 ${booking.name} 的预约状态`}
                      data-booking-id={booking.id}
                      value={booking.status}
                      disabled={updatingId === booking.id}
                      onChange={(e) =>
                        handleRequestedStatusChange(booking.id, e.target.value as OrderStatus)
                      }
                      className="h-8 min-w-[7rem] rounded-lg border border-input bg-background px-2 text-sm disabled:opacity-50"
                    >
                      {[booking.status, ...STATUS_TARGETS[booking.status]].map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {booking.notificationSummary.latestStatus
                      ? EMAIL_DELIVERY_LABELS[
                          booking.notificationSummary.latestStatus
                        ]
                      : booking.email
                        ? "尚无邮件"
                        : "无邮箱，需电话联系"}
                    {booking.notificationSummary.failedCount > 0 && (
                      <span className="block text-xs text-destructive">
                        {booking.notificationSummary.failedCount} 封发送失败
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="text-sm text-primary underline-offset-2 hover:underline"
                    >
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingStatusChange && (
        <BookingStatusDialog
          isSubmitting={updatingId === pendingStatusChange.id}
          expectedStatus={pendingStatusChange.expectedStatus}
          onCancel={() => setPendingStatusChange(null)}
          onConfirm={handleDialogConfirm}
          open
          status={pendingStatusChange.status}
        />
      )}
    </div>
  );
}
