"use client";

import { useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { getAdminOrders, updateOrderStatus } from "@/lib/admin/api";
import type { CartOrder, CartOrderItem, OrderStatus } from "@/lib/admin/types";

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
  if (style) return `${name}（${style}）${item.price ? ` · ${item.price}` : ""}`;
  const detail = item.date ? `${item.date} / ${item.people ?? 0} 人` : "";
  return `${name}${detail ? ` · ${detail}` : ""}${item.price ? ` · ${item.price}` : ""}`;
}

export default function AdminOrdersPage() {
  const [items, setItems] = useState<CartOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const load = () => {
    setLoading(true);
    getAdminOrders()
      .then(setItems)
      .catch((err) =>
        setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    setUpdatingId(id);
    try {
      const updated = await updateOrderStatus(id, status);
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
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">购物车订单</h1>
        <p className="text-sm text-muted-foreground">查看顾客从项目页加入购物车后提交的订单</p>
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
        <p className="text-sm text-muted-foreground">暂无订单</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">提交时间</th>
                <th className="px-4 py-3 font-medium">顾客</th>
                <th className="px-4 py-3 font-medium">商品</th>
                <th className="px-4 py-3 font-medium">备注</th>
                <th className="px-4 py-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{order.name}</div>
                    <div>{order.phone}</div>
                    {order.wechat && (
                      <div className="text-xs text-muted-foreground">微信: {order.wechat}</div>
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
                  <td className="max-w-[180px] px-4 py-3 text-muted-foreground">
                    {order.message || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) =>
                        handleStatusChange(order.id, e.target.value as OrderStatus)
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
