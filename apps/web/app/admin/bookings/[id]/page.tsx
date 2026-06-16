"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import { getAdminBooking, updateBookingStatus } from "@/lib/admin/api";
import type { Booking, OrderStatus } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";

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

export default function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    getAdminBooking(id)
      .then(setBooking)
      .catch((err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (status: OrderStatus) => {
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
    setUpdating(true);
    try {
      const updated = await updateBookingStatus(id, status, note);
      setBooking(updated);
      setMessage({ type: "success", text: "状态已更新" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
    } finally {
      setUpdating(false);
    }
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
            <p className="font-medium">{booking.phone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">微信</p>
            <p className="font-medium">{booking.wechat || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">邮箱</p>
            <p className="font-medium">{booking.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">类型</p>
            <p className="font-medium">{ACTIVITY_LABELS[booking.activityType || ""] || booking.activityType || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">意向日期</p>
            <p className="font-medium">{booking.preferredDate || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">人数</p>
            <p className="font-medium">{booking.numberOfPeople ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">意向项目</p>
            <p className="font-medium">{booking.interestedProject || "—"}</p>
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
            <Button size="sm" variant="outline" disabled={updating} onClick={() => handleStatusChange("contacted")}>
              标记为已联系
            </Button>
          )}
          {booking.status !== "confirmed" && booking.status !== "cancelled" && (
            <Button size="sm" variant="outline" disabled={updating} onClick={() => handleStatusChange("confirmed")}>
              确认预约
            </Button>
          )}
          {booking.status !== "cancelled" && (
            <Button size="sm" variant="destructive" disabled={updating} onClick={() => handleStatusChange("cancelled")}>
              取消预约
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
