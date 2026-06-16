"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AlertBanner from "@/components/admin/AlertBanner";
import {
  getAdminBookings,
  markNotificationsRead,
  updateBookingStatus,
} from "@/lib/admin/api";
import type { Booking, OrderStatus } from "@/lib/admin/types";

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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminBookingsPage() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const load = () => {
    setLoading(true);
    getAdminBookings()
      .then((result) => setItems("data" in result ? result.data : result as unknown as Booking[]))
      .catch((err) =>
        setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    markNotificationsRead("bookings").catch(() => {});
  }, []);

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    let note: string | undefined;
    if (status === "confirmed" || status === "cancelled") {
      const input = window.prompt(
        status === "confirmed"
          ? "确认备注（将写入发给客户的邮件，可留空）"
          : "取消原因（将发给客户，建议填写）",
      );
      if (input === null) return;
      note = input.trim() || undefined;
    }

    setUpdatingId(id);
    try {
      const updated = await updateBookingStatus(id, status, note);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setMessage({ type: "success", text: "状态已更新" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "更新失败",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">预约管理</h1>
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
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">意向日期</th>
                <th className="px-4 py-3 font-medium">人数</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">备注</th>
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
                    <div>{booking.phone}</div>
                    {booking.wechat && (
                      <div className="text-xs text-muted-foreground">微信: {booking.wechat}</div>
                    )}
                    {booking.email && (
                      <div className="text-xs text-muted-foreground">{booking.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {booking.activityType
                      ? ACTIVITY_LABELS[booking.activityType] ?? booking.activityType
                      : "—"}
                    {booking.interestedProject && (
                      <div className="text-xs text-muted-foreground">
                        {booking.interestedProject}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{booking.preferredDate ?? "—"}</td>
                  <td className="px-4 py-3">{booking.numberOfPeople ?? "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={booking.status}
                      disabled={updatingId === booking.id}
                      onChange={(e) =>
                        handleStatusChange(booking.id, e.target.value as OrderStatus)
                      }
                      className="h-8 min-w-[7rem] rounded-lg border border-input bg-background px-2 text-sm disabled:opacity-50"
                    >
                      {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 text-muted-foreground">
                    {booking.message || "—"}
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
    </div>
  );
}
