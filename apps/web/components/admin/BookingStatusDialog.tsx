"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { requiresCustomerNote } from "@/lib/admin/booking-status";
import type { OrderStatus } from "@/lib/admin/types";

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
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const noteId = useId();
  const noteInputId = useId();
  const requiresNote = requiresCustomerNote(status);
  const isCancellation = status === "cancelled";

  useEffect(() => {
    if (!open || !requiresNote) return;

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    noteRef.current?.focus();

    return () => previouslyFocusedElement?.focus();
  }, [open, requiresNote]);

  if (!open || !requiresNote) return null;

  const handleConfirm = async () => {
    setSubmissionError(null);
    try {
      await onConfirm({ status, note: note.trim() || undefined });
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "更新失败，请重试");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (!isSubmitting) {
        event.preventDefault();
        onCancel();
      }
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "textarea:not(:disabled), button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]",
      ),
    );
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === firstElement || !event.currentTarget.contains(document.activeElement))
    ) {
      event.preventDefault();
      lastElement?.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === lastElement || !event.currentTarget.contains(document.activeElement))
    ) {
      event.preventDefault();
      firstElement?.focus();
    }
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
        onKeyDown={handleKeyDown}
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

        <label className="mt-5 block text-sm font-medium text-foreground" htmlFor={noteInputId}>
          {isCancellation ? "取消说明（建议填写）" : "确认备注（可选）"}
        </label>
        <textarea
          className="mt-2 min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          id={noteInputId}
          onChange={(event) => setNote(event.target.value)}
          placeholder={isCancellation ? "例如：该时段已满，欢迎选择其他日期" : "例如：已为您保留星期六下午 2 点的时段"}
          value={note}
          ref={noteRef}
        />

        {submissionError && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            更新失败：{submissionError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
            返回
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={() => void handleConfirm()}
            type="button"
            variant={isCancellation ? "destructive" : "default"}
          >
            {isSubmitting
              ? "更新中…"
              : status === "cancelled"
                ? "确认取消"
                : "确认预约"}
          </Button>
        </div>
      </div>
    </div>
  );
}
