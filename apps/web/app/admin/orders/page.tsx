"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import BookingStatusDialog, {
  type BookingStatusDialogResult,
} from "@/components/admin/BookingStatusDialog";
import {
  getAdminOrders,
  updateOrderStatus,
} from "@/lib/admin/api";
import type {
  CartOrder,
  CartOrderItem,
  OrderStatus,
} from "@/lib/admin/types";
import {
  formatOrderActionError,
  isStaleOrderStatus,
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

function formatItemSummary(item: CartOrderItem) {
  const name = displayName(item.projectName);
  const style = displayStyle(item.styleName);
  const itemLabel = style ? `${name}（${style}）` : name;
  const price = item.price
    ? `${item.price} ${item.priceCurrency}`
    : null;
  return [itemLabel, price].filter(Boolean).join(" · ");
}

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusOrderAfterRefreshRef = useRef<string | null>(null);
  const [items, setItems] = useState<CartOrder[]>([]);
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<OrderStatus | "">(
    () => (searchParams.get("status") as OrderStatus | null) ?? "",
  );
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [unread, setUnread] = useState(() => searchParams.get("unread") === "true");
  const [overdue, setOverdue] = useState(() => searchParams.get("overdue") === "true");
  const [confirmedToday, setConfirmedToday] = useState(
    () => searchParams.get("confirmedToday") === "true",
  );
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    id: string;
    status: OrderStatus;
    expectedStatus: OrderStatus;
  } | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const load = async ({ showLoading = true, nextPage = page } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const result = await getAdminOrders({
        page: nextPage,
        status: status || undefined,
        search: search || undefined,
        unread,
        overdue,
        confirmedToday,
      });
      setItems(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages ?? Math.max(1, Math.ceil(result.total / 25)));
      return true;
    } catch {
      setMessage({
        type: "error",
        text: "产品预约记录加载失败，请稍后重试",
      });
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, []);

  const applyFilters = () => {
    setPage(1);
    void load({ nextPage: 1 });
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    void load({ nextPage });
  };

  useEffect(() => {
    const orderId = focusOrderAfterRefreshRef.current;
    if (!orderId) return;
    const statusControl = Array.from(
      document.querySelectorAll<HTMLSelectElement>("select[data-order-id]"),
    ).find((control) => control.dataset.orderId === orderId);
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
      focusOrderAfterRefreshRef.current = null;
    }
  }, [items, updatingId]);

  const handleStatusChange = async (
    id: string,
    result: BookingStatusDialogResult,
  ) => {
    setUpdatingId(id);
    try {
      const updated = await updateOrderStatus(id, result);
      setItems((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      setMessage({ type: "success", text: "状态已更新" });
    } catch (error) {
      const stale = isStaleOrderStatus(error);
      const localized = formatOrderActionError(error);
      setMessage({ type: "error", text: localized });
      if (stale) {
        focusOrderAfterRefreshRef.current = id;
        setPendingStatusChange(null);
        await load({ showLoading: false });
      }
      return localized;
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRequestedStatusChange = (
    id: string,
    status: OrderStatus,
  ) => {
    const order = items.find((item) => item.id === id);
    if (!order || order.status === status) return;
    setPendingStatusChange({
      id,
      status,
      expectedStatus: order.status,
    });
  };

  const handleDialogConfirm = async (
    result: BookingStatusDialogResult,
  ) => {
    if (!pendingStatusChange) return;
    const error = await handleStatusChange(
      pendingStatusChange.id,
      result,
    );
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
          产品预约
        </h1>
        <p className="text-sm text-muted-foreground">
          查看顾客提交的产品制作预约
        </p>
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
          <input className="h-9 min-w-56 rounded-lg border border-input bg-background px-3" onChange={(event) => setSearch(event.target.value)} value={search} />
        </label>
        <label className="grid gap-1 text-sm">
          状态
          <select className="h-9 rounded-lg border border-input bg-background px-3" onChange={(event) => setStatus(event.target.value as OrderStatus | "")} value={status}>
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
        <p className="text-sm text-muted-foreground">暂无产品预约</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">提交时间</th>
                <th className="px-4 py-3 font-medium">顾客</th>
                <th className="px-4 py-3 font-medium">商品</th>
                <th className="px-4 py-3 font-medium">预约时段</th>
                <th className="px-4 py-3 font-medium">人数</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">邮件</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border align-top last:border-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {order.isUnread && <span className="mr-2 inline-flex rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">未读</span>}
                      {order.name}
                    </div>
                    <a className="hover:underline" href={`tel:${order.phone}`}>
                      {order.phone}
                    </a>
                    {order.email ? (
                      <a
                        className="block text-xs text-muted-foreground hover:underline"
                        href={`mailto:${order.email}`}
                      >
                        {order.email}
                      </a>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        无邮箱，需电话联系
                      </div>
                    )}
                    {order.wechat && (
                      <div className="text-xs text-muted-foreground">
                        微信: {order.wechat}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1">
                      {order.items.map((item) => (
                        <li key={item.id} className="text-warm-charcoal">
                          {formatItemSummary(item)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {order.slot ? (
                      <>
                        <span>{order.slot.date}</span>
                        <span className="block text-xs text-muted-foreground">
                          {order.slot.startTime && order.slot.endTime
                            ? `${order.slot.startTime}–${order.slot.endTime}`
                            : "历史记录无具体时间"}
                        </span>
                      </>
                    ) : (
                      "资料不完整"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {order.numberOfPeople ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`更新 ${order.name} 的产品预约状态`}
                      data-order-id={order.id}
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(event) =>
                        handleRequestedStatusChange(
                          order.id,
                          event.target.value as OrderStatus,
                        )
                      }
                      className="h-8 min-w-[7rem] rounded-lg border border-input bg-background px-2 text-sm disabled:opacity-50"
                    >
                      {[order.status, ...STATUS_TARGETS[order.status]].map(
                        (status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {order.notificationSummary.latestStatus
                      ? EMAIL_DELIVERY_LABELS[
                          order.notificationSummary.latestStatus
                        ]
                      : order.email
                        ? "尚无邮件"
                        : "无邮箱，需电话联系"}
                    {order.notificationSummary.failedCount > 0 && (
                      <span className="block text-xs text-destructive">
                        {order.notificationSummary.failedCount} 封发送失败
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
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

      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 条，第 {page} / {totalPages} 页（每页 25 条）</span>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => goToPage(page - 1)} type="button">上一页</button>
            <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} type="button">下一页</button>
          </div>
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
