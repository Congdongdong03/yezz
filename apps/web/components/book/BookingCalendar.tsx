"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  fetchDaySlots,
  fetchMonthAvailability,
  type TimeSlotOption,
} from "@/lib/api/time-slots";
import {
  getOrdinaryAvailability,
  type OrdinaryAvailabilityQuery,
  type OrdinaryAvailabilitySlot,
} from "@/lib/api/availability";

type BookingCalendarProps = {
  people: number;
  categoryId?: string | null;
  selectedSlotId: string | null;
  onSelectSlot: (slot: TimeSlotOption | null) => void;
  onDateChange: (date: string) => void;
  ordinaryAvailability?: Pick<
    OrdinaryAvailabilityQuery,
    "attendance" | "durationMinutes"
  >;
  selectedOrdinaryStartTime?: string | null;
  onSelectOrdinarySlot?: (slot: OrdinaryAvailabilitySlot | null) => void;
  ordinaryRefreshKey?: number;
};

const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function melbourneDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Australia/Melbourne",
    year: "numeric",
  }).format(now);
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function OrdinaryBookingCalendar({
  ordinaryAvailability,
  selectedOrdinaryStartTime,
  onSelectOrdinarySlot,
  onDateChange,
  ordinaryRefreshKey,
}: BookingCalendarProps & {
  ordinaryAvailability: NonNullable<
    BookingCalendarProps["ordinaryAvailability"]
  >;
}) {
  const t = useTranslations("bookingCalendar");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<OrdinaryAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => melbourneDate(), []);
  const lastDate = useMemo(() => addCalendarDays(today, 7), [today]);
  const { attendance, durationMinutes } = ordinaryAvailability;

  const load = useCallback(
    async (nextDate: string) => {
      if (!nextDate) return;
      setLoading(true);
      setError(null);
      try {
        const result = await getOrdinaryAvailability({
          date: nextDate,
          attendance,
          durationMinutes,
        });
        setSlots(result);
      } catch {
        setSlots([]);
        setError(t("ordinaryLoadError"));
      } finally {
        setLoading(false);
      }
    },
    [attendance, durationMinutes, t],
  );

  useEffect(() => {
    if (date) {
      void Promise.resolve().then(() => load(date));
    }
  }, [
    date,
    attendance,
    durationMinutes,
    load,
    ordinaryRefreshKey,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <label
          className="text-sm font-semibold text-warm-charcoal"
          htmlFor="ordinary-booking-date"
        >
          {t("ordinaryDate")}
        </label>
        <input
          className="mt-2 min-h-11 w-full rounded-xl border border-warm-grey/25 bg-white px-3 text-base text-warm-charcoal outline-none transition focus-visible:border-caramel focus-visible:ring-2 focus-visible:ring-caramel/25"
          id="ordinary-booking-date"
          max={lastDate}
          min={today}
          onChange={(event) => {
            const nextDate = event.target.value;
            setDate(nextDate);
            setSlots([]);
            onDateChange(nextDate);
          }}
          type="date"
          value={date}
        />
        <p className="mt-2 text-xs text-warm-grey">
          {t("melbourneTime")}
        </p>
      </div>

      {loading && (
        <p className="rounded-xl bg-sage/10 px-4 py-3 text-sm text-warm-grey">
          {t("checking")}
        </p>
      )}
      {error && (
        <p
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      {!loading && !error && date && slots.length === 0 && (
        <p className="rounded-xl bg-warm-grey/10 px-4 py-3 text-sm text-warm-grey">
          {t("ordinaryEmpty")}
        </p>
      )}
      {slots.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {slots.map((slot) => {
            const waitlist = slot.status === "waitlist";
            const selected = selectedOrdinaryStartTime === slot.startTime;
            const action = waitlist
              ? t("waitlistAction")
              : t("availableAction");
            return (
              <button
                aria-label={`${action}: ${slot.startTime} – ${slot.endTime}, ${t("melbourneTime")}`}
                aria-pressed={selected}
                className={`min-h-11 rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2 ${
                  selected
                    ? "border-caramel bg-caramel text-white"
                    : waitlist
                      ? "border-lavender bg-lavender/15 text-warm-charcoal hover:border-caramel"
                      : "border-sage/60 bg-sage/15 text-warm-charcoal hover:border-caramel"
                }`}
                key={`${slot.date}-${slot.startTime}`}
                onClick={() => onSelectOrdinarySlot?.(slot)}
                type="button"
              >
                <span className="flex items-center justify-between gap-3">
                  <strong>
                    {slot.startTime} – {slot.endTime}
                  </strong>
                  <span className="text-xs">
                    {waitlist
                      ? t("waitlistStatus")
                      : t("availableStatus")}
                  </span>
                </span>
                <span className="mt-1 block text-xs opacity-80">
                  {action}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs leading-5 text-warm-grey">
        {t("manualConfirmation")}
      </p>
    </div>
  );
}

function LegacyBookingCalendar({
  people,
  categoryId,
  selectedSlotId,
  onSelectSlot,
  onDateChange,
}: BookingCalendarProps) {
  const t = useTranslations("bookingCalendar");
  const locale = useLocale();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [monthMap, setMonthMap] = useState<
    Record<string, "none" | "available" | "full">
  >({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySlots, setDaySlots] = useState<TimeSlotOption[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const weekdays = locale === "zh" ? WEEKDAYS_ZH : WEEKDAYS_EN;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-AU", {
        day: "numeric",
        month: "long",
        weekday: "long",
        year: "numeric",
      }),
    [locale],
  );

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true);
    setMonthError(null);
    try {
      const data = await fetchMonthAvailability(year, month, categoryId);
      const map: Record<string, "none" | "available" | "full"> = {};
      for (const entry of data.dates) {
        map[entry.date] = entry.status;
      }
      setMonthMap(map);
    } catch {
      setMonthMap({});
      setMonthError(t("loadError"));
    } finally {
      setLoadingMonth(false);
    }
  }, [year, month, categoryId, t]);

  useEffect(() => {
    void Promise.resolve().then(loadMonth);
  }, [loadMonth]);

  const selectDate = async (
    date: string,
    status: "none" | "available" | "full",
  ) => {
    if (status !== "available") return;
    setSelectedDate(date);
    onDateChange(date);
    onSelectSlot(null);
    setLoadingDay(true);
    setDayError(null);
    try {
      const data = await fetchDaySlots(date, categoryId);
      setDaySlots(data.slots);
    } catch {
      setDaySlots([]);
      setDayError(t("loadError"));
    } finally {
      setLoadingDay(false);
    }
  };

  const calendarCells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: Array<{
      date: string;
      day: number;
      status: "none" | "available" | "full" | "pad";
    }> = [];

    for (let i = 0; i < startPad; i++) {
      cells.push({ date: "", day: 0, status: "pad" });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date, day: d, status: monthMap[date] ?? "none" });
    }
    return cells;
  }, [year, month, monthMap]);

  const shiftMonth = (delta: number) => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
    setSelectedDate(null);
    setDaySlots([]);
    onSelectSlot(null);
  };

  return (
    <div className="space-y-4">
      {monthError && (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {monthError}
        </p>
      )}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label={t("prevMonth")}
          className="rounded-lg px-2 py-1 text-sm text-warm-grey hover:bg-warm-grey/10"
        >
          ←
        </button>
        <p className="font-medium text-warm-charcoal">
          {year}-{String(month).padStart(2, "0")}
          {loadingMonth && (
            <span className="ml-2 text-xs text-warm-grey">{t("loading")}</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label={t("nextMonth")}
          className="rounded-lg px-2 py-1 text-sm text-warm-grey hover:bg-warm-grey/10"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-warm-grey">
        {weekdays.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, idx) => {
          if (cell.status === "pad") {
            return <div key={`pad-${idx}`} />;
          }
          const dayStatus = cell.status;
          const isSelected = selectedDate === cell.date;
          const availabilityLabel =
            dayStatus === "available"
              ? t("legendAvailable")
              : dayStatus === "full"
                ? t("legendFull")
                : t("legendNone");
          const dateLabel = `${dateFormatter.format(new Date(`${cell.date}T00:00:00`))} — ${availabilityLabel}`;
          const color =
            dayStatus === "available"
              ? isSelected
                ? "bg-caramel text-white"
                : "bg-sage/30 text-warm-charcoal hover:bg-sage/50"
              : dayStatus === "full"
                ? "bg-red-100 text-red-700"
                : "bg-warm-grey/10 text-warm-grey/60";

          return (
            <button
              key={cell.date}
              data-date={cell.date}
              aria-disabled={dayStatus !== "available"}
              aria-label={dateLabel}
              aria-pressed={isSelected}
              type="button"
              disabled={dayStatus !== "available"}
              onClick={() => selectDate(cell.date, dayStatus)}
              className={`aspect-square rounded-lg text-sm transition-colors ${color} disabled:cursor-not-allowed`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-warm-grey">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-sage/30" />{" "}
          {t("legendAvailable")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-100" />{" "}
          {t("legendFull")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-warm-grey/10" />{" "}
          {t("legendNone")}
        </span>
      </div>

      <p className="text-xs text-warm-grey">{t("manualConfirmation")}</p>

      {selectedDate && (
        <div>
          <p className="text-sm font-medium text-warm-charcoal">
            {t("pickSlot")}
          </p>
          {dayError ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {dayError}
            </p>
          ) : loadingDay ? (
            <p className="mt-2 text-sm text-warm-grey">{t("loading")}</p>
          ) : daySlots.length === 0 ? (
            <p className="mt-2 text-sm text-warm-grey">{t("noSlots")}</p>
          ) : (
            <div className="mt-2 space-y-2">
              {daySlots.map((slot) => {
                const fits = slot.remaining >= people;
                const selected = selectedSlotId === slot.id;
                return (
                  <button
                    key={slot.id}
                    data-slot-id={slot.id}
                    type="button"
                    disabled={!fits}
                    onClick={() => onSelectSlot(slot)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? "border-caramel bg-caramel/10"
                        : "border-warm-grey/20 bg-white hover:border-caramel"
                    } disabled:opacity-40`}
                  >
                    <span>
                      {slot.startTime} – {slot.endTime}
                      {slot.almostFull && fits && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          {t("almostFull")}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-warm-grey">
                      {t("remaining", { count: slot.remaining })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookingCalendar(props: BookingCalendarProps) {
  if (props.ordinaryAvailability) {
    return (
      <OrdinaryBookingCalendar
        {...props}
        ordinaryAvailability={props.ordinaryAvailability}
      />
    );
  }
  return <LegacyBookingCalendar {...props} />;
}
