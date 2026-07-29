"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import BookingWorkflowDialog, {
  type BookingWorkflowPayload,
} from "@/components/admin/BookingWorkflowDialog";
import {
  getAdminBooking,
  getAdminBookings,
  getBookingCalendar,
  recordBookingCharge,
  recordBookingPayment,
  recordBookingRefund,
  runBookingTransition,
} from "@/lib/admin/api";
import { cacheBookingCalendar } from "@/lib/admin/calendar-store";
import type { Booking, BookingStatus, OrderStatus } from "@/lib/admin/types";
import {
  bookingActionsFor,
  formatBookingActionError,
  isStaleBookingStatus,
  melbourneLocalToIso,
  type BookingWorkflowAction,
} from "@/lib/admin/booking-status";
import { EMAIL_DELIVERY_LABELS } from "@/lib/admin/email-delivery";
import { parseAdminQueueSearchParams } from "@/lib/admin/queue-query";

const STATUS_LABELS: Record<BookingStatus, string> = {
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

const ACTION_LABELS: Record<BookingWorkflowAction, string> = {
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

function formatAttendance(booking: Booking) {
  if (!booking.attendance) return booking.numberOfPeople == null ? "—" : `${booking.numberOfPeople} 人`;
  const { participantCount, accompanyingAdultCount, totalCount } = booking.attendance;
  if (booking.kind === "party") {
    return `${participantCount} 位参与者${accompanyingAdultCount == null ? "" : `，${accompanyingAdultCount} 位家长`}（共 ${totalCount} 人）`;
  }
  const children = booking.attendance.youngChildCount;
  return `${participantCount} 位制作${children ? `，${children} 名儿童` : ""}${accompanyingAdultCount ? `，${accompanyingAdultCount} 位陪同` : ""}（共 ${totalCount} 人）`;
}

export default function AdminBookingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = parseAdminQueueSearchParams(searchParams);
  const queryKey = searchParams?.toString() ?? "";
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusBookingAfterRefreshRef = useRef<string | null>(null);
  const [items, setItems] = useState<Booking[]>([]);
  const [page, setPage] = useState(() => initialQuery.page ?? 1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<OrderStatus | "">(
    () => initialQuery.status ?? "",
  );
  const [search, setSearch] = useState(() => initialQuery.search ?? "");
  const [unread, setUnread] = useState(() => initialQuery.unread ?? false);
  const [overdue, setOverdue] = useState(() => initialQuery.overdue ?? false);
  const [confirmedToday, setConfirmedToday] = useState(
    () => initialQuery.confirmedToday ?? false,
  );
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingWorkflow, setPendingWorkflow] = useState<{
    id: string;
    action: BookingWorkflowAction;
  } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const load = useCallback(async ({ showLoading = true, nextPage = page } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const result = await getAdminBookings({
        page: nextPage,
        status: status || undefined,
        search: search || undefined,
        unread,
        overdue,
        confirmedToday,
      });
      const data = "data" in result ? result.data : (result as unknown as Booking[]);
      const resultTotal = Array.isArray(result) ? data.length : result.total;
      setItems(data);
      setTotal(resultTotal);
      setTotalPages(
        !Array.isArray(result) && result.totalPages
          ? result.totalPages
          : Math.max(1, Math.ceil(resultTotal / 25)),
      );
      return true;
    } catch {
      setMessage({ type: "error", text: "预约记录加载失败，请稍后重试" });
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [confirmedToday, overdue, page, search, status, unread]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    const next = parseAdminQueueSearchParams(searchParams);
    void Promise.resolve().then(() => {
      setPage(next.page ?? 1);
      setStatus(next.status ?? "");
      setSearch(next.search ?? "");
      setUnread(next.unread ?? false);
      setOverdue(next.overdue ?? false);
      setConfirmedToday(next.confirmedToday ?? false);
    });
  }, [queryKey, searchParams]);

  const applyFilters = () => {
    setPage(1);
    updateUrl(1);
    void load({ nextPage: 1 });
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    updateUrl(nextPage);
    void load({ nextPage });
  };

  const updateUrl = (nextPage: number) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    const values: Record<string, string | undefined> = {
      page: nextPage > 1 ? String(nextPage) : undefined,
      status: status || undefined,
      search: search.trim() || undefined,
      unread: unread ? "true" : undefined,
      overdue: overdue ? "true" : undefined,
      confirmedToday: confirmedToday ? "true" : undefined,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`/admin/bookings${next.size ? `?${next}` : ""}`);
  };

  useEffect(() => {
    const bookingId = focusBookingAfterRefreshRef.current;
    if (!bookingId) return;
    const statusControl = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "button[data-booking-id]",
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

  const handleWorkflow = async (
    id: string,
    result: BookingWorkflowPayload,
  ) => {
    setUpdatingId(id);
    try {
      const toStatus: Partial<
        Record<BookingWorkflowAction, BookingStatus>
      > = {
        confirm: "confirmed",
        waitlist: "waitlisted",
        reject: "rejected",
        cancel: "cancelled",
        complete: "completed",
        no_show: "no_show",
      };
      if (result.action === "record_payment") {
        await recordBookingPayment(id, {
          expectedStatus: "awaiting_in_store_payment",
          operationId: result.operationId,
          amountCents: result.amountCents as 9500 | 14500,
          paidAt: melbourneLocalToIso(result.recordedAt!),
        });
      } else if (result.action === "add_charge") {
        await recordBookingCharge(id, {
          expectedStatus: "confirmed_paid",
          operationId: result.operationId,
          type: result.chargeType!,
          amountCents: result.amountCents!,
          note: result.note,
        });
      } else if (result.action === "refund") {
        await recordBookingRefund(id, {
          expectedStatus: "cancelled",
          operationId: result.operationId,
          refundedAt: melbourneLocalToIso(result.recordedAt!),
        });
      } else {
        await runBookingTransition(id, {
          expectedStatus: result.expectedStatus,
          operationId: result.operationId,
          ...(result.action === "propose_time"
            ? {
                action: "propose_party_time",
                finalDate: result.finalDate,
                finalGuestStart: result.finalStartTime,
                paymentDeadline: melbourneLocalToIso(
                  result.paymentDeadline!,
                ),
              }
            : result.action === "accept_time"
              ? { action: "accept_party_time" }
              : {
                  action: "transition",
                  toStatus: toStatus[result.action],
                  contactedCustomer: result.contactedCustomer,
                  note: result.note,
                  ...(result.action === "confirm"
                    ? {
                        newDate: result.finalDate,
                        newStartTime: result.finalStartTime,
                      }
                    : {}),
                }),
        });
      }
      const updated = await getAdminBooking(id);
      if (updated.slot?.date) {
        cacheBookingCalendar(
          await getBookingCalendar(updated.slot.date, updated.slot.date),
        );
      }
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setMessage({ type: "success", text: "预约记录已更新" });
    } catch (err) {
      const stale = isStaleBookingStatus(err);
      const localized = formatBookingActionError(err);
      setMessage({
        type: "error",
        text: localized,
      });
      if (stale) {
        focusBookingAfterRefreshRef.current = id;
        setPendingWorkflow(null);
        await load({ showLoading: false });
      }
      return localized;
    } finally {
      setUpdatingId(null);
    }
  };

  const requestWorkflow = (id: string, action: BookingWorkflowAction) => {
    const booking = items.find((item) => item.id === id);
    if (!booking) return;
    setPendingWorkflow({ id, action });
  };

  const handleDialogConfirm = async (result: BookingWorkflowPayload) => {
    if (!pendingWorkflow) return;
    const error = await handleWorkflow(pendingWorkflow.id, result);
    if (!error) setPendingWorkflow(null);
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

      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <label className="grid gap-1 text-sm">
          搜索姓名、电话或邮箱
          <input
            className="h-9 min-w-56 rounded-lg border border-input bg-background px-3"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
        </label>
        <label className="grid gap-1 text-sm">
          状态
          <select
            className="h-9 rounded-lg border border-input bg-background px-3"
            onChange={(event) => setStatus(event.target.value as OrderStatus | "")}
            value={status}
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input checked={unread} onChange={(event) => setUnread(event.target.checked)} type="checkbox" />仅未读</label>
        <label className="flex items-center gap-2 text-sm"><input checked={overdue} onChange={(event) => setOverdue(event.target.checked)} type="checkbox" />超时未处理</label>
        <label className="flex items-center gap-2 text-sm"><input checked={confirmedToday} onChange={(event) => setConfirmedToday(event.target.checked)} type="checkbox" />今日确认</label>
        <button className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground" type="submit">筛选</button>
      </form>

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
                  <td className="px-4 py-3 font-medium">
                    {booking.isUnread && <span className="mr-2 inline-flex rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">未读</span>}
                    {booking.name}
                  </td>
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
                    <span className="block text-xs text-muted-foreground">
                      政策 {booking.policyVersion ?? "历史记录未记录"}
                    </span>
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
                  <td className="px-4 py-3">{formatAttendance(booking)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex border-l-2 border-[#D96F9E] pl-2 font-medium">
                      {STATUS_LABELS[booking.status]}
                    </span>
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
                    <div className="flex min-w-48 flex-wrap gap-1.5">
                      {bookingActionsFor(booking.kind, booking.status).map(
                        (action, index) => (
                          <button
                            aria-label={`${ACTION_LABELS[action]} ${booking.name}`}
                            className="rounded border border-[#DED9D7] bg-white px-2 py-1 text-xs hover:border-[#D96F9E] focus-visible:outline-2 disabled:opacity-50"
                            data-booking-id={
                              index === 0 ? booking.id : undefined
                            }
                            disabled={updatingId === booking.id}
                            key={action}
                            onClick={() => requestWorkflow(booking.id, action)}
                            type="button"
                          >
                            {ACTION_LABELS[action]}
                          </button>
                        ),
                      )}
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="px-2 py-1 text-xs text-primary underline-offset-2 hover:underline"
                      >
                        详情
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 条，第 {page} / {totalPages} 页（每页 25 条）</span>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => goToPage(page - 1)} type="button">上一页</button>
            <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} type="button">下一页</button>
          </div>
        </div>
      )}

      {pendingWorkflow && (
        <BookingWorkflowDialog
          action={pendingWorkflow.action}
          booking={items.find((item) => item.id === pendingWorkflow.id)!}
          isSubmitting={updatingId === pendingWorkflow.id}
          onCancel={() => setPendingWorkflow(null)}
          onConfirm={handleDialogConfirm}
          open
        />
      )}
    </div>
  );
}
