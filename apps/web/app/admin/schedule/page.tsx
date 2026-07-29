"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getBookingCalendar } from "@/lib/admin/api";
import type {
  BookingCalendar,
  BookingCalendarDay,
} from "@/lib/admin/types";
import {
  cacheBookingCalendar,
  mergeCachedBookingCalendar,
  subscribeBookingCalendar,
} from "@/lib/admin/calendar-store";

function calendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function deadlineLabel(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Australia/Melbourne",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function timeLabel(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(
    value % 60,
  ).padStart(2, "0")}`;
}

function buildSharedTimeRows(days: BookingCalendarDay[]): string[] {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const day of days) {
    if (day.opensAt) starts.push(timeMinutes(day.opensAt));
    if (day.closesAt) ends.push(timeMinutes(day.closesAt));
    for (const interval of day.intervals) {
      starts.push(timeMinutes(interval.startTime));
      ends.push(timeMinutes(interval.endTime));
    }
    for (const party of day.partyBlocks) {
      starts.push(timeMinutes(party.setupStart));
      ends.push(timeMinutes(party.cleanupEnd));
    }
    for (const closure of day.closures) {
      if (closure.startTime) starts.push(timeMinutes(closure.startTime));
      if (closure.endTime) ends.push(timeMinutes(closure.endTime));
    }
  }
  const start =
    Math.floor((starts.length > 0 ? Math.min(...starts) : 9 * 60) / 30) * 30;
  const end =
    Math.ceil((ends.length > 0 ? Math.max(...ends) : 17 * 60) / 30) * 30;
  return Array.from(
    { length: Math.max(1, (end - start) / 30) },
    (_, index) => timeLabel(start + index * 30),
  );
}

function gridRowFor(value: string, firstTime: string): number {
  return (timeMinutes(value) - timeMinutes(firstTime)) / 30 + 2;
}

export default function AdminSchedulePage() {
  const [from, setFrom] = useState(() => calendarDate(new Date()));
  const [calendar, setCalendar] = useState<BookingCalendar | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const to = shiftDate(from, 6);
  const timeRows = useMemo(
    () => buildSharedTimeRows(calendar?.days ?? []),
    [calendar],
  );

  const load = useCallback(async () => {
    setMessage(null);
    try {
      const next = await getBookingCalendar(from, to);
      cacheBookingCalendar(next);
      setCalendar(next);
    } catch {
      setMessage("排班日历加载失败，请稍后重试");
    }
  }, [from, to]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(
    () =>
      subscribeBookingCalendar(() => {
        setCalendar((current) =>
          current ? mergeCachedBookingCalendar(current) : current,
        );
      }),
    [],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[#D96F9E]">
            YezYY 运营排班
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#302F2F]">
            七日工作台
          </h1>
          <p className="text-sm text-[#6E6968]">
            {from} — {to} · Australia/Melbourne
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setFrom(shiftDate(from, -7))} size="sm" variant="outline">
            上一周
          </Button>
          <Button onClick={() => setFrom(calendarDate(new Date()))} size="sm" variant="outline">
            今天
          </Button>
          <Button onClick={() => setFrom(shiftDate(from, 7))} size="sm" variant="outline">
            下一周
          </Button>
        </div>
      </header>

      {message && (
        <p className="border-l-2 border-[#B5473F] bg-white px-3 py-2 text-sm" role="alert">
          {message}
        </p>
      )}

      {!calendar ? (
        <p className="text-sm text-[#6E6968]">正在读取排班…</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <div
            aria-label="七日预约日历"
            className="grid min-w-[96rem] overflow-hidden rounded-lg border bg-[#DED9D7]"
            role="grid"
            style={{
              gridTemplateColumns: `5.5rem repeat(${calendar.days.length}, minmax(12.5rem, 1fr))`,
              gridTemplateRows: `auto repeat(${timeRows.length}, minmax(3.5rem, auto))`,
            }}
          >
          <div
            className="sticky left-0 top-0 z-30 border-b border-r bg-[#F5F3F2] px-2 py-3 text-xs font-semibold text-[#6E6968]"
            role="columnheader"
          >
            时间
          </div>
          {calendar.days.map((day, dayIndex) => (
            <header
              className="sticky top-0 z-20 border-b border-r bg-[#F5F3F2] px-3 py-3"
              key={day.date}
              role="columnheader"
              style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
            >
              <h2 className="font-sans font-semibold">{day.date}</h2>
              <p className="font-sans text-xs text-[#6E6968]">
                {day.isClosed
                  ? "全天闭店"
                  : `${day.opensAt ?? "—"}–${day.closesAt ?? "—"}`}
              </p>
              {day.specialHours && (
                <p className="mt-1 border-l-2 border-[#D96F9E] pl-2 text-xs">
                  {day.specialHours.isClosed
                    ? "全天特别闭店"
                    : `特别营业 ${day.specialHours.opensAt}–${day.specialHours.closesAt}`}
                  {day.specialHours.note ? ` · ${day.specialHours.note}` : ""}
                </p>
              )}
              {day.emailFailures.length > 0 && (
                <p className="mt-1 text-xs text-[#B5473F]">
                  邮件失败{" "}
                  {day.emailFailures.reduce(
                    (sum, item) => sum + item.count,
                    0,
                  )}
                </p>
              )}
            </header>
          ))}

          {timeRows.map((startTime, rowIndex) => (
            <div
              className="sticky left-0 z-10 border-b border-r bg-[#F5F3F2] px-2 py-2 text-xs font-semibold tabular-nums text-[#6E6968]"
              data-time-row={startTime}
              key={startTime}
              role="rowheader"
              style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
            >
              {startTime}–
              {timeLabel(timeMinutes(startTime) + 30)}
            </div>
          ))}

          {calendar.days.flatMap((day, dayIndex) => {
            const intervals = new Map(
              day.intervals.map((interval) => [
                interval.startTime,
                interval,
              ]),
            );
            return timeRows.map((startTime, rowIndex) => {
              const interval = intervals.get(startTime);
              return (
                <div
                  className={`min-w-0 border-b border-r bg-white px-2 py-1.5 ${
                    !interval || interval.closed
                      ? "bg-[repeating-linear-gradient(135deg,#F5F3F2,#F5F3F2_6px,#ECE8E6_6px,#ECE8E6_12px)]"
                      : ""
                  }`}
                  data-date={day.date}
                  data-time={startTime}
                  key={`${day.date}-${startTime}`}
                  role="gridcell"
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: rowIndex + 2,
                  }}
                >
                  {interval && !interval.closed && !interval.partyBlocked && (
                    <p className="text-xs tabular-nums">
                      已到 {interval.ordinaryAttendance} / 8 · 剩余{" "}
                      {interval.remainingOrdinaryCapacity}
                    </p>
                  )}
                  {interval?.ordinaryBookings.map((booking) => (
                    <Link
                      className="mt-1 block border-l-2 border-[#D96F9E] pl-2 text-xs hover:underline focus-visible:outline-2"
                      href={`/admin/bookings/${booking.bookingId}`}
                      key={booking.bookingId}
                    >
                      {booking.name} · {booking.attendance} 人
                      {booking.emailFailureCount > 0
                        ? ` · 邮件失败 ${booking.emailFailureCount}`
                        : ""}
                    </Link>
                  ))}
                </div>
              );
            });
          })}

          {calendar.days.flatMap((day, dayIndex) =>
            day.closures.map((closure) => {
              const startTime = closure.startTime ?? timeRows[0]!;
              const endTime =
                closure.endTime ??
                timeLabel(timeMinutes(timeRows.at(-1)!) + 30);
              return (
                <div
                  className="pointer-events-none z-10 m-0.5 border border-[#B5473F] bg-[#FFF7F6]/95 px-2 py-1 text-xs text-[#B5473F]"
                  data-closure-id={closure.id}
                  key={closure.id}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: `${gridRowFor(startTime, timeRows[0]!)} / ${gridRowFor(endTime, timeRows[0]!)}`,
                  }}
                >
                  闭店 {closure.startTime ?? "全天"}
                  {closure.endTime ? `–${closure.endTime}` : ""}
                  {closure.note ? ` · ${closure.note}` : ""}
                </div>
              );
            }),
          )}

          {calendar.days.flatMap((day, dayIndex) =>
            day.partyBlocks.flatMap((party) => {
              const phases = [
                {
                  key: "setup",
                  label: `准备 ${party.setupStart}–${party.guestStart}`,
                  start: party.setupStart,
                  end: party.guestStart,
                  className: "bg-[#F9E8EF]",
                },
                {
                  key: "guest",
                  label: `客人 ${party.guestStart}–${party.guestEnd} · ${party.name}`,
                  start: party.guestStart,
                  end: party.guestEnd,
                  className: "bg-white font-semibold",
                },
                {
                  key: "cleanup",
                  label: `收尾 ${party.guestEnd}–${party.cleanupEnd}`,
                  start: party.guestEnd,
                  end: party.cleanupEnd,
                  className: "bg-[#F5F3F2]",
                },
              ] as const;
              return phases.map((phase) => (
                <Link
                  className={`z-20 m-0.5 overflow-hidden border border-[#D96F9E] px-2 py-1 text-xs focus-visible:outline-2 ${phase.className}`}
                  data-party-phase={phase.key}
                  href={`/admin/bookings/${party.bookingId}`}
                  key={`${party.bookingId}-${phase.key}`}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: `${gridRowFor(phase.start, timeRows[0]!)} / ${gridRowFor(phase.end, timeRows[0]!)}`,
                  }}
                >
                  {phase.label}
                  {phase.key === "guest" && party.paymentDeadline && (
                    <span className="mt-1 block font-normal text-[#B5473F]">
                      付款期限 {deadlineLabel(party.paymentDeadline)}
                    </span>
                  )}
                </Link>
              ));
            }),
          )}
          </div>
        </div>
      )}
    </div>
  );
}
