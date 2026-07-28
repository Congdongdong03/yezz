"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { Button } from "@/components/ui/button";
import { getEmailDeliveries, retryEmailDelivery } from "@/lib/admin/api";
import {
  EMAIL_DELIVERY_LABELS,
  EMAIL_MESSAGE_TYPE_LABELS,
  formatDeliveryErrorForAdmin,
  formatEmailDeliveryActionError,
} from "@/lib/admin/email-delivery";
import type { EmailDelivery, EmailDeliveryStatus } from "@/lib/admin/types";

const PAGE_SIZE = 25;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function requestLink(delivery: EmailDelivery) {
  if (delivery.bookingId) {
    return {
      href: `/admin/bookings/${delivery.bookingId}`,
      label: "查看预约",
    };
  }
  if (delivery.cartOrderId) {
    return {
      href: `/admin/orders/${delivery.cartOrderId}`,
      label: "查看订单",
    };
  }
  return null;
}

export default function EmailDeliveriesPage() {
  const [items, setItems] = useState<EmailDelivery[]>([]);
  const [status, setStatus] = useState<EmailDeliveryStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getEmailDeliveries({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
      });
      setItems(result.data);
      setTotal(result.total);
    } catch (error) {
      setNotice({
        type: "error",
        text: formatEmailDeliveryActionError("load", error),
      });
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">
          邮件发送
        </h1>
        <p className="text-sm text-muted-foreground">
          查看预约通知的排队、发送和失败状态
        </p>
      </div>

      {notice && (
        <AlertBanner
          type={notice.type}
          message={notice.text}
          onDismiss={() => setNotice(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="delivery-status">
          发送状态
        </label>
        <select
          id="delivery-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as EmailDeliveryStatus | "");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">全部</option>
          {(Object.keys(EMAIL_DELIVERY_LABELS) as EmailDeliveryStatus[]).map(
            (value) => (
              <option key={value} value={value}>
                {EMAIL_DELIVERY_LABELS[value]}
              </option>
            ),
          )}
        </select>
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          暂无邮件发送记录
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">收件人</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">尝试次数</th>
                <th className="px-4 py-3 font-medium">最后处理</th>
                <th className="px-4 py-3 font-medium">错误</th>
                <th className="px-4 py-3 font-medium">关联请求</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((delivery) => {
                const linkedRequest = requestLink(delivery);
                return (
                  <tr
                    key={delivery.id}
                    className="border-b border-border align-top last:border-0"
                  >
                    <td className="px-4 py-3">
                      {EMAIL_DELIVERY_LABELS[delivery.deliveryStatus]}
                    </td>
                    <td className="px-4 py-3">{delivery.recipient}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {EMAIL_MESSAGE_TYPE_LABELS[delivery.messageType] ??
                        "其他邮件"}
                    </td>
                    <td className="px-4 py-3">{delivery.attemptCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(delivery.updatedAt)}
                    </td>
                    <td
                      className="max-w-[260px] px-4 py-3 text-muted-foreground"
                      title={formatDeliveryErrorForAdmin(delivery.lastError)}
                    >
                      <span className="line-clamp-3">
                        {formatDeliveryErrorForAdmin(delivery.lastError)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {linkedRequest ? (
                        <Link
                          href={linkedRequest.href}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {linkedRequest.label}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {delivery.deliveryStatus === "failed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retryingId === delivery.id}
                          onClick={async () => {
                            setRetryingId(delivery.id);
                            try {
                              await retryEmailDelivery(delivery.id);
                              setNotice({
                                type: "success",
                                text: "已重新加入发送队列",
                              });
                              await load();
                            } catch (error) {
                              setNotice({
                                type: "error",
                                text: formatEmailDeliveryActionError(
                                  "retry",
                                  error,
                                ),
                              });
                            } finally {
                              setRetryingId(null);
                            }
                          }}
                        >
                          {retryingId === delivery.id ? "处理中…" : "重新发送"}
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          上一页
        </Button>
        <span className="text-sm text-muted-foreground">
          第 {page} / {pages} 页
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages || loading}
          onClick={() => setPage((value) => Math.min(pages, value + 1))}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
