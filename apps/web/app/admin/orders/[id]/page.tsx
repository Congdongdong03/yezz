"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import BookingStatusDialog, {
  type BookingStatusDialogResult,
} from "@/components/admin/BookingStatusDialog";
import { Button } from "@/components/ui/button";
import { getAdminOrder, updateOrderStatus } from "@/lib/admin/api";
import {
  formatOrderActionError,
  isStaleOrderStatus,
} from "@/lib/admin/booking-status";
import {
  EMAIL_DELIVERY_LABELS,
  EMAIL_MESSAGE_TYPE_LABELS,
  formatDeliveryErrorForAdmin,
} from "@/lib/admin/email-delivery";
import type {
  CartOrder,
  CartOrderItem,
  OrderStatus,
} from "@/lib/admin/types";

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

function displayName(value: CartOrderItem["projectName"]) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return value.zh || value.en || "—";
}

function displayStyle(value: CartOrderItem["styleName"]) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.zh || value.en || null;
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<CartOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    status: OrderStatus;
    expectedStatus: OrderStatus;
  } | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    getAdminOrder(id)
      .then(setOrder)
      .catch(() =>
        setMessage({
          type: "error",
          text: "产品预约详情加载失败，请稍后重试",
        }),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (
    result: BookingStatusDialogResult,
  ) => {
    setUpdating(true);
    try {
      const updated = await updateOrderStatus(id, result);
      setOrder(updated);
      setMessage({ type: "success", text: "状态已更新" });
    } catch (error) {
      const stale = isStaleOrderStatus(error);
      const localized = formatOrderActionError(error);
      setMessage({ type: "error", text: localized });
      if (stale) {
        setPendingStatusChange(null);
        try {
          setOrder(await getAdminOrder(id));
        } catch {
          setMessage({
            type: "error",
            text: "产品预约状态已变化，详情刷新失败，请手动刷新页面",
          });
        }
      }
      return localized;
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestedStatusChange = (status: OrderStatus) => {
    if (!order || order.status === status) return;
    setPendingStatusChange({
      status,
      expectedStatus: order.status,
    });
  };

  const handleDialogConfirm = async (
    result: BookingStatusDialogResult,
  ) => {
    const error = await handleStatusChange(result);
    if (!error) setPendingStatusChange(null);
    return error;
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }
  if (!order) {
    return <p className="text-sm text-muted-foreground">产品预约不存在</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          ← 返回
        </Button>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">
          产品预约详情
        </h1>
      </div>

      {message && (
        <AlertBanner
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      <div className="space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">姓名</p>
            <p className="font-medium">{order.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">电话</p>
            <a
              className="font-medium hover:underline"
              href={`tel:${order.phone}`}
            >
              {order.phone}
            </a>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">邮箱</p>
            {order.email ? (
              <a
                className="font-medium hover:underline"
                href={`mailto:${order.email}`}
              >
                {order.email}
              </a>
            ) : (
              <p className="font-medium">无邮箱，需电话联系</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">微信</p>
            <p className="font-medium">{order.wechat || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">预约时段</p>
            <p className="font-medium">
              {order.slot
                ? `${order.slot.date} ${
                    order.slot.startTime && order.slot.endTime
                      ? `${order.slot.startTime}–${order.slot.endTime}`
                      : "历史记录无具体时间"
                  } ${order.slot.timeZone}`
                : "资料不完整"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">人数</p>
            <p className="font-medium">
              {order.numberOfPeople ?? "资料不完整"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">当前状态</p>
            <p className="font-medium">{STATUS_LABELS[order.status]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">提交时间</p>
            <p className="font-medium">{formatDate(order.createdAt)}</p>
          </div>
        </div>

        {order.message && (
          <div>
            <p className="text-xs text-muted-foreground">备注 / 留言</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {order.message}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <h2 className="font-medium">商品清单</h2>
          {order.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">无商品快照</p>
          ) : (
            <div className="space-y-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-muted/50 p-3 text-sm"
                >
                  <p className="font-medium">
                    {displayName(item.projectName)}
                  </p>
                  {item.styleName && (
                    <p className="text-muted-foreground">
                      款式：{displayStyle(item.styleName)}
                    </p>
                  )}
                  {item.price && (
                    <p className="text-muted-foreground">
                      价格：{item.price} {item.priceCurrency}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {STATUS_TARGETS[order.status].map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === "cancelled" ? "destructive" : "outline"}
              disabled={updating}
              onClick={() => handleRequestedStatusChange(status)}
            >
              {status === "contacted"
                ? "标记为已联系"
                : status === "confirmed"
                  ? "确认预约"
                  : "取消预约"}
            </Button>
          ))}
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold">状态记录</h2>
        {order.statusHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无状态变更记录</p>
        ) : (
          <ol className="space-y-3">
            {order.statusHistory.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <p className="font-medium">
                  {STATUS_LABELS[event.fromStatus]} →{" "}
                  {STATUS_LABELS[event.toStatus]}
                </p>
                <p className="text-muted-foreground">
                  {event.actor.name} · {formatDate(event.createdAt)}
                </p>
                {event.note && <p className="mt-1">{event.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold">邮件发送状态</h2>
        {order.emailDeliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {order.email ? "尚无邮件记录" : "无邮箱，需电话联系"}
          </p>
        ) : (
          <ul className="space-y-3">
            {order.emailDeliveries.map((delivery) => (
              <li
                key={delivery.id}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <p className="font-medium">
                  {EMAIL_MESSAGE_TYPE_LABELS[delivery.messageType] ??
                    "状态通知"}
                  ：{EMAIL_DELIVERY_LABELS[delivery.deliveryStatus]}
                </p>
                <p className="text-muted-foreground">
                  {delivery.recipient} · 尝试 {delivery.attemptCount} 次
                </p>
                {delivery.lastError && (
                  <p className="mt-1 text-destructive">
                    {formatDeliveryErrorForAdmin(delivery.lastError)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingStatusChange && (
        <BookingStatusDialog
          expectedStatus={pendingStatusChange.expectedStatus}
          isSubmitting={updating}
          onCancel={() => setPendingStatusChange(null)}
          onConfirm={handleDialogConfirm}
          open
          status={pendingStatusChange.status}
        />
      )}
    </div>
  );
}
