"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BookingWorkflowAction } from "@/lib/admin/booking-status";
import type { BookingStatus } from "@/lib/admin/types";

type WorkflowBooking = {
  id: string;
  kind: "experience" | "party";
  status: BookingStatus;
  slot: {
    id: string | null;
    date: string;
    startTime: string | null;
    endTime: string | null;
    timeZone: string;
  } | null;
  numberOfPeople: number | null;
};

export type BookingWorkflowPayload = {
  action: BookingWorkflowAction;
  expectedStatus: BookingStatus;
  operationId: string;
  finalDate?: string;
  finalStartTime?: string;
  contactedCustomer?: boolean;
  paymentDeadline?: string;
  amountCents?: number;
  recordedAt?: string;
  chargeType?: "cake_cutting" | "cleaning" | "overtime";
  note?: string;
};

const TITLES: Record<BookingWorkflowAction, string> = {
  confirm: "确认预约",
  waitlist: "转入候补",
  reject: "拒绝申请",
  propose_time: "提出派对时段",
  accept_time: "接受派对时段",
  record_payment: "记录场地费",
  add_charge: "记录额外费用",
  cancel: "取消预约",
  refund: "记录退款",
  complete: "标记已完成",
  no_show: "标记未到店",
};

export default function BookingWorkflowDialog({
  open,
  action,
  booking,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  action: BookingWorkflowAction;
  booking: WorkflowBooking;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (
    payload: BookingWorkflowPayload,
  ) => void | Promise<void | string> | string;
}) {
  const titleId = useId();
  const firstControlRef = useRef<HTMLInputElement>(null);
  const operationIdRef = useRef(globalThis.crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [finalDate, setFinalDate] = useState(booking.slot?.date ?? "");
  const [finalStartTime, setFinalStartTime] = useState(
    booking.slot?.startTime ?? "",
  );
  const [contactedCustomer, setContactedCustomer] = useState(false);
  const [paymentDeadline, setPaymentDeadline] = useState("");
  const [amountCents, setAmountCents] = useState("9500");
  const [recordedAt, setRecordedAt] = useState("");
  const [chargeType, setChargeType] = useState<
    "cake_cutting" | "cleaning" | "overtime"
  >("cake_cutting");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) firstControlRef.current?.focus();
  }, [open]);

  if (!open) return null;
  const waitlistConversion =
    action === "confirm" && booking.status === "waitlisted";
  const noteAction = ["reject", "cancel", "refund", "complete", "no_show"].includes(
    action,
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (
      (action === "confirm" || action === "propose_time") &&
      !/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(finalStartTime)
    ) {
      setError("开始时间必须选择整点或半点");
      return;
    }
    const result = await onConfirm({
      action,
      expectedStatus: booking.status,
      operationId: operationIdRef.current,
      ...(action === "confirm"
        ? {
            finalDate,
            finalStartTime,
            ...(waitlistConversion ? { contactedCustomer } : {}),
          }
        : {}),
      ...(action === "propose_time"
        ? { finalDate, finalStartTime, paymentDeadline }
        : {}),
      ...(action === "record_payment"
        ? { amountCents: Number(amountCents), recordedAt }
        : {}),
      ...(action === "add_charge"
        ? {
            chargeType,
            amountCents: Number(amountCents),
            note: note.trim() || undefined,
          }
        : {}),
      ...(action === "refund" ? { recordedAt } : {}),
      ...(noteAction ? { note: note.trim() || undefined } : {}),
    });
    if (typeof result === "string") setError(result);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !isSubmitting) onCancel();
      }}
    >
      <form
        aria-busy={isSubmitting}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-xl border border-[#DED9D7] bg-white p-5 shadow-xl"
        onSubmit={(event) => void submit(event)}
        role="dialog"
      >
        <h2 id={titleId} className="text-xl font-semibold text-[#302F2F]">
          {TITLES[action]}
        </h2>

        {(action === "confirm" || action === "propose_time") && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              最终日期
              <input
                className="h-10 rounded-md border px-3 font-sans"
                name="finalDate"
                onChange={(event) => setFinalDate(event.target.value)}
                ref={firstControlRef}
                required
                type="date"
                value={finalDate}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {action === "propose_time" ? "客人开始时间" : "最终开始时间"}
              <input
                className="h-10 rounded-md border px-3 font-sans"
                name="finalStartTime"
                min="00:00"
                onChange={(event) => {
                  setFinalStartTime(event.target.value);
                  setError(null);
                }}
                onInvalid={(event) => {
                  event.preventDefault();
                  setError("开始时间必须选择整点或半点");
                }}
                required
                step={1800}
                type="time"
                value={finalStartTime}
              />
            </label>
          </div>
        )}

        {action === "confirm" && (
          <p className="mt-3 border-l-2 border-[#D96F9E] pl-3 text-sm text-[#6E6968]">
            到店 {booking.numberOfPeople ?? "—"} 人 · 普通预约上限 8 人
          </p>
        )}

        {waitlistConversion && (
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              checked={contactedCustomer}
              className="mt-0.5 size-4 accent-[#D96F9E]"
              name="contactedCustomer"
              onChange={(event) => setContactedCustomer(event.target.checked)}
              required
              type="checkbox"
            />
            已联系顾客并确认该时段
          </label>
        )}

        {action === "propose_time" && (
          <label className="mt-4 grid gap-1 text-sm font-medium">
            到店场地费付款期限（墨尔本时间）
            <input
              className="h-10 rounded-md border px-3 font-sans"
              name="paymentDeadline"
              onChange={(event) => setPaymentDeadline(event.target.value)}
              required
              type="datetime-local"
              value={paymentDeadline}
            />
          </label>
        )}

        {action === "record_payment" && (
          <>
            <p className="mt-3 text-sm text-[#6E6968]">
              仅记录到店支付；系统不会向顾客收款。
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                场地费金额
                <select
                  className="h-10 rounded-md border bg-white px-3"
                  name="amountCents"
                  onChange={(event) => setAmountCents(event.target.value)}
                  value={amountCents}
                >
                  <option value="9500">A$95.00</option>
                  <option value="14500">A$145.00</option>
                </select>
              </label>
              <RecordedAt
                onChange={setRecordedAt}
                ref={firstControlRef}
                value={recordedAt}
              />
            </div>
          </>
        )}

        {action === "add_charge" && (
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm font-medium">
              费用类型
              <select
                className="h-10 rounded-md border bg-white px-3"
                name="chargeType"
                onChange={(event) =>
                  setChargeType(
                    event.target.value as
                      | "cake_cutting"
                      | "cleaning"
                      | "overtime",
                  )
                }
                value={chargeType}
              >
                <option value="cake_cutting">切蛋糕费</option>
                <option value="cleaning">清洁费</option>
                <option value="overtime">超时费</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              金额（澳分）
              <input
                className="h-10 rounded-md border px-3"
                min={0}
                name="amountCents"
                onChange={(event) => setAmountCents(event.target.value)}
                required
                type="number"
                value={amountCents}
              />
            </label>
          </div>
        )}

        {action === "refund" && (
          <div className="mt-4">
            <RecordedAt
              label="退款记录时间（墨尔本时间）"
              onChange={setRecordedAt}
              ref={firstControlRef}
              value={recordedAt}
            />
          </div>
        )}

        {(noteAction || action === "add_charge") && (
          <label className="mt-4 grid gap-1 text-sm font-medium">
            {action === "add_charge" ? "费用备注" : "处理说明"}
            <textarea
              className="min-h-24 rounded-md border px-3 py-2"
              name="note"
              onChange={(event) => setNote(event.target.value)}
              required={noteAction}
              value={note}
            />
          </label>
        )}

        {error && (
          <p className="mt-3 text-sm text-[#B5473F]" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
            返回
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "处理中…" : TITLES[action]}
          </Button>
        </div>
      </form>
    </div>
  );
}

function RecordedAt({
  value,
  onChange,
  label = "到店支付时间（墨尔本时间）",
  ref,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border px-3 font-sans"
        name="recordedAt"
        onChange={(event) => onChange(event.target.value)}
        ref={ref}
        required
        type="datetime-local"
        value={value}
      />
    </label>
  );
}
