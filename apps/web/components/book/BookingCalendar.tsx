"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  fetchDaySlots,
  fetchMonthAvailability,
  type TimeSlotOption,
} from "@/lib/api/time-slots";

type BookingCalendarProps = {
  people: number;
  categoryId?: string;
  selectedSlotId: string | null;
  onSelectSlot: (slot: TimeSlotOption | null) => void;
  onDateChange: (date: string) => void;
};

const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function BookingCalendar({
  people,
  categoryId,
  selectedSlotId,
  onSelectSlot,
  onDateChange,
}: BookingCalendarProps) {
  const t = useTranslations("bookingCalendar");
  const locale = useLocale();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [monthMap, setMonthMap] = useState<Record<string, "none" | "available" | "full">>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySlots, setDaySlots] = useState<TimeSlotOption[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const weekdays = locale === "zh" ? WEEKDAYS_ZH : WEEKDAYS_EN;

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const data = await fetchMonthAvailability(year, month, categoryId);
      const map: Record<string, "none" | "available" | "full"> = {};
      for (const entry of data.dates) {
        map[entry.date] = entry.status;
      }
      setMonthMap(map);
    } catch {
      setMonthMap({});
    } finally {
      setLoadingMonth(false);
    }
  }, [year, month, categoryId]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const selectDate = async (date: string, status: "none" | "available" | "full") => {
    if (status !== "available") return;
    setSelectedDate(date);
    onDateChange(date);
    onSelectSlot(null);
    setLoadingDay(true);
    try {
      const data = await fetchDaySlots(date, categoryId);
      setDaySlots(data.slots);
    } catch {
      setDaySlots([]);
    } finally {
      setLoadingDay(false);
    }
  };

  const calendarCells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: Array<{ date: string; day: number; status: "none" | "available" | "full" | "pad" }> =
      [];

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
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDate(null);
    setDaySlots([]);
    onSelectSlot(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg px-2 py-1 text-sm text-warm-grey hover:bg-warm-grey/10"
        >
          ←
        </button>
        <p className="font-medium text-warm-charcoal">
          {year}-{String(month).padStart(2, "0")}
          {loadingMonth && <span className="ml-2 text-xs text-warm-grey">{t("loading")}</span>}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
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
          <span className="inline-block h-3 w-3 rounded bg-sage/30" /> {t("legendAvailable")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-100" /> {t("legendFull")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-warm-grey/10" /> {t("legendNone")}
        </span>
      </div>

      {selectedDate && (
        <div>
          <p className="text-sm font-medium text-warm-charcoal">{t("pickSlot")}</p>
          {loadingDay ? (
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
