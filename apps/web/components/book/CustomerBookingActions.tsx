"use client";

import { useId, useState } from "react";
import { useParams } from "next/navigation";
import enMessages from "@/lib/i18n/messages/en.json";
import zhMessages from "@/lib/i18n/messages/zh.json";
import {
  acceptProposedTime,
  requestCustomerCancellation,
  requestCustomerReschedule,
  type CustomerBookingAction,
  type CustomerBookingView,
} from "@/lib/api/customer-booking";

type CustomerBookingActionsProps = {
  booking: CustomerBookingView;
};

export default function CustomerBookingActions({
  booking,
}: CustomerBookingActionsProps) {
  const params = useParams<{ token?: string | string[] }>();
  const copy =
    booking.locale === "zh"
      ? zhMessages.customerBooking
      : enMessages.customerBooking;
  const id = useId();
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStartTime, setRescheduleStartTime] = useState("");
  const [rescheduleErrors, setRescheduleErrors] = useState<{
    date?: string;
    time?: string;
  }>({});
  const [workingAction, setWorkingAction] =
    useState<CustomerBookingAction | null>(null);
  const [complete, setComplete] = useState(false);
  const [actionError, setActionError] = useState(false);

  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] ?? "" : tokenParam ?? "";
  const allowed = new Set(booking.allowedActions);
  const dateErrorId = `${id}-date-error`;
  const timeErrorId = `${id}-time-error`;

  const perform = async (
    action: CustomerBookingAction,
    operation: () => Promise<unknown>,
  ) => {
    setWorkingAction(action);
    setActionError(false);
    try {
      await operation();
      setComplete(true);
    } catch {
      setActionError(true);
    } finally {
      setWorkingAction(null);
    }
  };

  const requestReschedule = async () => {
    const nextErrors = {
      ...(!/^\d{4}-\d{2}-\d{2}$/.test(rescheduleDate)
        ? { date: copy.rescheduleDateRequired }
        : {}),
      ...(!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(rescheduleStartTime)
        ? { time: copy.rescheduleTimeRequired }
        : {}),
    };
    setRescheduleErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      queueMicrotask(() => {
        document
          .getElementById(
            nextErrors.date ? `${id}-rescheduleDate` : `${id}-rescheduleStartTime`,
          )
          ?.focus();
      });
      return;
    }
    await perform("request_reschedule", () =>
      requestCustomerReschedule(token, {
        date: rescheduleDate,
        startTime: rescheduleStartTime,
      }),
    );
  };

  if (complete) {
    return (
      <section
        className="rounded-3xl border border-sage/45 bg-sage/15 p-6 sm:p-8"
        role="status"
      >
        <h2 className="font-serif text-2xl font-semibold text-warm-charcoal">
          {copy.pendingTitle}
        </h2>
        <p className="mt-3 text-sm leading-6 text-warm-charcoal">
          {copy.pendingBody}
        </p>
      </section>
    );
  }

  const actionButtonClass =
    "min-h-12 w-full rounded-full bg-caramel px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";
  const secondaryButtonClass =
    "min-h-12 w-full rounded-full border border-caramel px-5 py-3 text-sm font-semibold text-caramel transition hover:bg-caramel/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";
  const inputClass =
    "mt-2 min-h-11 w-full rounded-xl border border-warm-grey/25 bg-white px-3 text-base text-warm-charcoal outline-none focus-visible:border-caramel focus-visible:ring-2 focus-visible:ring-caramel/25";

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-warm-grey/15 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-caramel">
          {booking.kind === "party" ? copy.partyLabel : copy.experienceLabel}
        </p>
        <h2 className="mt-2 font-serif text-2xl font-bold text-warm-charcoal">
          {booking.offeringLabel}
        </h2>
        <dl className="mt-5 grid gap-4 rounded-2xl bg-cream p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-warm-charcoal">{copy.date}</dt>
            <dd className="mt-1 text-warm-grey">{booking.date}</dd>
          </div>
          <div>
            <dt className="font-semibold text-warm-charcoal">{copy.time}</dt>
            <dd className="mt-1 text-warm-grey">
              {booking.startTime}–{booking.endTime} · {copy.melbourneTime}
            </dd>
          </div>
        </dl>
      </section>

      {allowed.has("accept_time") && booking.proposedTime && (
        <section className="rounded-3xl border border-lavender/50 bg-lavender/10 p-6 sm:p-8">
          <h2 className="font-serif text-xl font-semibold text-warm-charcoal">
            {copy.proposedTitle}
          </h2>
          <p className="mt-3 text-lg font-semibold text-warm-charcoal">
            {booking.proposedTime.date}
          </p>
          <p className="mt-1 text-sm text-warm-grey">
            {booking.proposedTime.startTime}–{booking.proposedTime.endTime} ·{" "}
            {copy.melbourneTime}
          </p>
          <p className="mt-4 text-sm leading-6 text-warm-grey">
            {copy.acceptHelp}
          </p>
          <button
            className={`${actionButtonClass} mt-5`}
            disabled={workingAction !== null}
            onClick={() =>
              void perform("accept_time", () => acceptProposedTime(token))
            }
            type="button"
          >
            {workingAction === "accept_time"
              ? copy.working
              : copy.acceptTime}
          </button>
        </section>
      )}

      {allowed.has("request_cancellation") && (
        <section className="rounded-3xl border border-warm-grey/15 bg-white p-6 sm:p-8">
          <h2 className="font-serif text-xl font-semibold text-warm-charcoal">
            {copy.cancellationTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-warm-grey">
            {booking.kind === "party"
              ? copy.partyCancellationHelp
              : copy.experienceCancellationHelp}
          </p>
          <button
            className={`${secondaryButtonClass} mt-5`}
            disabled={workingAction !== null}
            onClick={() =>
              void perform("request_cancellation", () =>
                requestCustomerCancellation(token),
              )
            }
            type="button"
          >
            {workingAction === "request_cancellation"
              ? copy.working
              : copy.requestCancellation}
          </button>
        </section>
      )}

      {allowed.has("request_reschedule") && (
        <section className="rounded-3xl border border-warm-grey/15 bg-white p-6 sm:p-8">
          <h2 className="font-serif text-xl font-semibold text-warm-charcoal">
            {copy.rescheduleTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-warm-grey">
            {copy.rescheduleHelp}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="text-sm font-semibold text-warm-charcoal"
                htmlFor={`${id}-rescheduleDate`}
              >
                {copy.preferredDate}
              </label>
              <input
                aria-describedby={
                  rescheduleErrors.date ? dateErrorId : undefined
                }
                aria-invalid={Boolean(rescheduleErrors.date)}
                className={inputClass}
                id={`${id}-rescheduleDate`}
                name="rescheduleDate"
                onChange={(event) => {
                  setRescheduleDate(event.target.value);
                  setRescheduleErrors((current) => ({
                    ...current,
                    date: undefined,
                  }));
                }}
                type="date"
                value={rescheduleDate}
              />
              {rescheduleErrors.date && (
                <p
                  className="mt-1 text-sm text-red-700"
                  id={dateErrorId}
                  role="alert"
                >
                  {rescheduleErrors.date}
                </p>
              )}
            </div>
            <div>
              <label
                className="text-sm font-semibold text-warm-charcoal"
                htmlFor={`${id}-rescheduleStartTime`}
              >
                {copy.preferredTime}
              </label>
              <input
                aria-describedby={
                  rescheduleErrors.time ? timeErrorId : undefined
                }
                aria-invalid={Boolean(rescheduleErrors.time)}
                className={inputClass}
                id={`${id}-rescheduleStartTime`}
                name="rescheduleStartTime"
                onChange={(event) => {
                  setRescheduleStartTime(event.target.value);
                  setRescheduleErrors((current) => ({
                    ...current,
                    time: undefined,
                  }));
                }}
                step={1800}
                type="time"
                value={rescheduleStartTime}
              />
              {rescheduleErrors.time && (
                <p
                  className="mt-1 text-sm text-red-700"
                  id={timeErrorId}
                  role="alert"
                >
                  {rescheduleErrors.time}
                </p>
              )}
            </div>
          </div>
          <button
            className={`${secondaryButtonClass} mt-5`}
            disabled={workingAction !== null}
            onClick={() => void requestReschedule()}
            type="button"
          >
            {workingAction === "request_reschedule"
              ? copy.working
              : copy.requestReschedule}
          </button>
        </section>
      )}

      {booking.allowedActions.length === 0 && (
        <section className="rounded-3xl border border-warm-grey/15 bg-white p-6 text-sm leading-6 text-warm-grey">
          {copy.noActions}
        </section>
      )}

      {actionError && (
        <p
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
          role="alert"
        >
          {copy.actionError}
        </p>
      )}
    </div>
  );
}
