"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import BookingStatusDialog, {
  type BookingStatusDialogResult,
} from "@/components/admin/BookingStatusDialog";
import { getAdminBooking, updateBookingStatus } from "@/lib/admin/api";
import { formatBookingActionError } from "@/lib/admin/booking-status";
import type { Booking, OrderStatus } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import {
  EMAIL_DELIVERY_LABELS,
  EMAIL_MESSAGE_TYPE_LABELS,
  formatDeliveryErrorForAdmin,
} from "@/lib/admin/email-delivery";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "新预约",
  contacted: "已联系",
  confirmed: "已确认",
  cancelled: "已取消",
};

const ACTIVITY_LABELS: Record<string, string> = {
  date: "约会",
  birthday: "生日",
  friends: "朋友聚会",
  kids: "亲子",
  mobile: "上门",
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

export default function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    status: OrderStatus;
    expectedStatus: OrderStatus;
  } | null>(null);

  useEffect(() => {
    getAdminBooking(id)
      .then(setBooking)
      .catch(() =>
        setMessage({
          type: "error",
          text: "预约详情加载失败，请稍后重试",
        }),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (result: BookingStatusDialogResult) => {
    setUpdating(true);
    try {
      const updated = await updateBookingStatus(id, result);
      setBooking(updated);
      setMessage({ type: "success", text: "状态已更新" });
    } catch (err) {
      const localized = formatBookingActionError(err);
      setMessage({ type: "error", text: localized });
      throw new Error(localized);
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestedStatusChange = (status: OrderStatus) => {
    if (!booking || booking.status === status) return;
    setPendingStatusChange({
      status,
      expectedStatus: booking.status,
    });
  };

  const handleDialogConfirm = async (result: BookingStatusDialogResult) => {
    await handleStatusChange(result);
    setPendingStatusChange(null);
  };

  if (loading) return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (!booking) return <p className="text-sm text-muted-foreground">预约不存在</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          ← 返回
        </Button>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">预约详情</h1>
      </div>

      {message && <AlertBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} />}

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">姓名</p>
            <p className="font-medium">{booking.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">电话</p>
            <a className="font-medium hover:underline" href={`tel:${booking.phone}`}>
              {booking.phone}
            </a>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">微信</p>
            <p className="font-medium">{booking.wechat || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">邮箱</p>
            {booking.email ? (
              <a
                className="font-medium hover:underline"
                href={`mailto:${booking.email}`}
              >
                {booking.email}
              </a>
            ) : (
              <p className="font-medium">无邮箱，需电话联系</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">类型</p>
            <p className="font-medium">{ACTIVITY_LABELS[booking.activityType || ""] || booking.activityType || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">预约时段</p>
            <p className="font-medium">
              {booking.slot
                ? `${booking.slot.date} ${
                    booking.slot.startTime && booking.slot.endTime
                      ? `${booking.slot.startTime}–${booking.slot.endTime}`
                      : "历史记录无具体时间"
                  }`
                : "资料不完整"}
            </p>
            {booking.slot && (
              <p className="text-xs text-muted-foreground">
                {booking.slot.timeZone}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">人数</p>
            <p className="font-medium">{booking.numberOfPeople ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">体验项目</p>
            <p className="font-medium">
              {booking.offering?.name?.zh ??
                booking.offering?.name?.en ??
                booking.interestedProject ??
                "资料不完整"}
            </p>
            {booking.offering?.price && (
              <p className="text-xs text-muted-foreground">
                {booking.offering.price}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">提交时间</p>
            <p className="font-medium">{formatDate(booking.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">当前状态</p>
            <p className="font-medium">{STATUS_LABELS[booking.status]}</p>
          </div>
        </div>

        {booking.message && (
          <div>
            <p className="text-xs text-muted-foreground">备注 / 留言</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{booking.message}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {booking.status !== "contacted" && booking.status !== "confirmed" && booking.status !== "cancelled" && (
            <Button size="sm" variant="outline" disabled={updating} onClick={() => handleRequestedStatusChange("contacted")}>
              标记为已联系
            </Button>
          )}
          {booking.status !== "confirmed" && booking.status !== "cancelled" && (
            <Button size="sm" variant="outline" disabled={updating} onClick={() => handleRequestedStatusChange("confirmed")}>
              确认预约
            </Button>
          )}
          {booking.status !== "cancelled" && (
            <Button size="sm" variant="destructive" disabled={updating} onClick={() => handleRequestedStatusChange("cancelled")}>
              取消预约
            </Button>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold text-warm-charcoal">
            状态记录
          </h2>
          <span className="text-sm text-muted-foreground">
            当前：{STATUS_LABELS[booking.status]}
          </span>
        </div>
        {booking.statusHistory.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">暂无状态变更记录</p>
        ) : (
          <ol className="mt-5 space-y-0">
            {booking.statusHistory.map((event, index) => (
              <li className="relative grid grid-cols-[1rem_1fr] gap-3 pb-5 last:pb-0" key={event.id}>
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-primary/10"
                />
                {index < booking.statusHistory.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[5px] top-5 h-[calc(100%-0.5rem)] w-px bg-border"
                  />
                )}
                <div>
                  <p className="font-medium">
                    {STATUS_LABELS[event.fromStatus]} → {STATUS_LABELS[event.toStatus]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.actor.name} · {formatDate(event.createdAt)}
                  </p>
                  {event.note && (
                    <p className="mt-1 whitespace-pre-wrap text-sm">{event.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold text-warm-charcoal">
          邮件发送记录
        </h2>
        {booking.emailDeliveries.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {booking.email ? "尚无邮件记录" : "无邮箱，需电话联系"}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {booking.emailDeliveries.map((delivery) => (
              <li className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[1fr_auto]" key={delivery.id}>
                <div>
                  <p className="font-medium">
                    {EMAIL_MESSAGE_TYPE_LABELS[delivery.messageType] ?? "预约邮件"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {delivery.recipient} · 尝试 {delivery.attemptCount} 次
                  </p>
                  {delivery.lastError && (
                    <p className="text-sm text-destructive">
                      {formatDeliveryErrorForAdmin(delivery.lastError)}
                    </p>
                  )}
                </div>
                <span className="text-sm font-medium">
                  {EMAIL_DELIVERY_LABELS[delivery.deliveryStatus]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingStatusChange && (
        <BookingStatusDialog
          isSubmitting={updating}
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
