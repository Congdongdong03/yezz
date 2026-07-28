"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { requiresCustomerNote } from "@/lib/admin/booking-status";
import type { OrderStatus } from "@/lib/admin/types";

export type BookingStatusDialogResult = {
  status: OrderStatus;
  expectedStatus: OrderStatus;
  operationId: string;
  note?: string;
};

type BookingStatusDialogProps = {
  open: boolean;
  status: OrderStatus;
  expectedStatus: OrderStatus;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (
    result: BookingStatusDialogResult,
  ) => void | string | Promise<void | string>;
};

const TITLES: Record<OrderStatus, string> = {
  new: "恢复为新预约",
  contacted: "标记为已联系",
  confirmed: "确认预约",
  cancelled: "取消预约",
};

export default function BookingStatusDialog({
  open,
  status,
  expectedStatus,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: BookingStatusDialogProps) {
  const [note, setNote] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const operationIdRef = useRef(globalThis.crypto.randomUUID());
  const titleId = useId();
  const descriptionId = useId();
  const noteInputId = useId();
  const requiresNote = requiresCustomerNote(status);
  const isCancellation = status === "cancelled";

  useEffect(() => {
    if (!open) return;

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    (requiresNote ? noteRef.current : cancelRef.current)?.focus();

    return () => previouslyFocusedElement?.focus();
  }, [open, requiresNote]);

  useEffect(() => {
    if (open && isSubmitting) {
      (requiresNote ? noteRef.current : cancelRef.current)?.focus();
    }
  }, [isSubmitting, open, requiresNote]);

  if (!open) return null;

  const handleConfirm = async () => {
    setSubmissionError(null);
    try {
      const safeError = await onConfirm({
        status,
        expectedStatus,
        operationId: operationIdRef.current,
        note: note.trim() || undefined,
      });
      if (safeError) setSubmissionError(safeError);
    } catch {
      setSubmissionError("状态更新失败，请重试");
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
      (document.activeElement === firstElement ||
        !event.currentTarget.contains(document.activeElement))
    ) {
      event.preventDefault();
      lastElement?.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === lastElement ||
        !event.currentTarget.contains(document.activeElement))
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
        aria-busy={isSubmitting}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <h2
          id={titleId}
          className="font-serif text-xl font-semibold text-warm-charcoal"
        >
          {TITLES[status]}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          {status === "contacted"
            ? "确认后会记录操作人员和时间，并向顾客发送状态邮件。"
            : isCancellation
              ? "取消后仅释放一次名额，并把取消说明发送给顾客。"
              : "顾客仍需到店付款；系统不会收取线上或预付款。"}
        </p>

        {requiresNote && (
          <>
            <label
              className="mt-5 block text-sm font-medium text-foreground"
              htmlFor={noteInputId}
            >
              {isCancellation ? "取消说明（建议填写）" : "确认备注（可选）"}
            </label>
            <textarea
              aria-disabled={isSubmitting}
              className="mt-2 min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 read-only:cursor-wait read-only:opacity-60"
              id={noteInputId}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                isCancellation
                  ? "例如：顾客来电取消，名额已释放"
                  : "例如：已电话确认星期六上午 10 点"
              }
              readOnly={isSubmitting}
              ref={noteRef}
              value={note}
            />
          </>
        )}

        {submissionError && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {submissionError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            disabled={isSubmitting}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
            variant="outline"
          >
            返回
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={() => void handleConfirm()}
            type="button"
            variant={isCancellation ? "destructive" : "default"}
          >
            {isSubmitting ? "更新中…" : TITLES[status]}
          </Button>
        </div>
      </div>
    </div>
  );
}
