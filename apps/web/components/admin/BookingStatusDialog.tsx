"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { requiresCustomerNote } from "@/lib/admin/booking-status";
import type { OrderStatus } from "@/lib/admin/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "新预约",
  contacted: "已联系",
  confirmed: "已确认",
  cancelled: "已取消",
};

export type BookingStatusDialogResult = {
  status: OrderStatus;
  note?: string;
};

type BookingStatusDialogProps = {
  open: boolean;
  status: OrderStatus;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (result: BookingStatusDialogResult) => void | Promise<void>;
};

export default function BookingStatusDialog({
  open,
  status,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: BookingStatusDialogProps) {
  const [note, setNote] = useState("");
  const titleId = useId();
  const noteId = useId();
  const requiresNote = requiresCustomerNote(status);
  const isCancellation = status === "cancelled";

  if (!open || !requiresNote) return null;

  const handleConfirm = () => {
    void onConfirm({ status, note: note.trim() || undefined });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="presentation"
    >
      <div
        aria-describedby={noteId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
        role="dialog"
      >
        <h2 id={titleId} className="font-serif text-xl font-semibold text-warm-charcoal">
          {isCancellation ? "取消预约" : "确认预约"}
        </h2>
        <p id={noteId} className="mt-2 text-sm text-muted-foreground">
          {isCancellation
            ? "取消说明将发送给顾客，建议填写。"
            : "可填写给顾客的确认备注；不填写也可以确认。"}
        </p>

        <label className="mt-5 block text-sm font-medium text-foreground" htmlFor="booking-status-note">
          {isCancellation ? "取消说明（建议填写）" : "确认备注（可选）"}
        </label>
        <textarea
          className="mt-2 min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          id="booking-status-note"
          onChange={(event) => setNote(event.target.value)}
          placeholder={isCancellation ? "例如：该时段已满，欢迎选择其他日期" : "例如：已为您保留星期六下午 2 点的时段"}
          value={note}
        />

        <div className="mt-6 flex justify-end gap-3">
          <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
            返回
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={handleConfirm}
            type="button"
            variant={isCancellation ? "destructive" : "default"}
          >
            {isSubmitting ? "更新中…" : `确认${STATUS_LABELS[status]}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
