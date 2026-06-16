"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import { getAdminOrder, updateOrderStatus } from "@/lib/admin/api";
import type { CartOrder, OrderStatus } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "新订单",
  contacted: "已联系",
  confirmed: "已确认",
  cancelled: "已取消",
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

function displayName(value: CartOrder["items"][number]["projectName"]) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return value.zh || value.en || "—";
}

function displayStyle(value: CartOrder["items"][number]["styleName"]) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.zh || value.en || null;
}

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<CartOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    getAdminOrder(params.id)
      .then(setOrder)
      .catch((err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleStatusChange = async (status: OrderStatus) => {
    setUpdating(true);
    try {
      const updated = await updateOrderStatus(params.id, status);
      setOrder(updated);
      setMessage({ type: "success", text: "状态已更新" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (!order) return <p className="text-sm text-muted-foreground">订单不存在</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          ← 返回
        </Button>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">订单详情</h1>
      </div>

      {message && <AlertBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} />}

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">姓名</p>
            <p className="font-medium">{order.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">电话</p>
            <p className="font-medium">{order.phone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">微信</p>
            <p className="font-medium">{order.wechat || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">提交时间</p>
            <p className="font-medium">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">当前状态</p>
            <p className="font-medium">{STATUS_LABELS[order.status]}</p>
          </div>
        </div>

        {order.message && (
          <div>
            <p className="text-xs text-muted-foreground">备注 / 留言</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{order.message}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">商品清单</p>
          {order.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">无商品</p>
          ) : (
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                  <p className="font-medium">{displayName(item.projectName)}</p>
                  {item.styleName && <p className="text-muted-foreground">款式：{displayStyle(item.styleName)}</p>}
                  {item.date && <p className="text-muted-foreground">日期：{item.date}</p>}
                  {item.people != null && <p className="text-muted-foreground">人数：{item.people}</p>}
                  {item.price && <p className="text-muted-foreground">价格：{item.price}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {order.status !== "contacted" && order.status !== "confirmed" && order.status !== "cancelled" && (
            <Button size="sm" variant="outline" disabled={updating} onClick={() => handleStatusChange("contacted")}>
              标记为已联系
            </Button>
          )}
          {order.status !== "confirmed" && order.status !== "cancelled" && (
            <Button size="sm" variant="outline" disabled={updating} onClick={() => handleStatusChange("confirmed")}>
              确认订单
            </Button>
          )}
          {order.status !== "cancelled" && (
            <Button size="sm" variant="destructive" disabled={updating} onClick={() => handleStatusChange("cancelled")}>
              取消订单
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
