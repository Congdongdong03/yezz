"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getBookingCalendar } from "@/lib/admin/api";
import type { BookingCalendar } from "@/lib/admin/types";

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

export default function AdminSchedulePage() {
  const [from, setFrom] = useState(() => calendarDate(new Date()));
  const [calendar, setCalendar] = useState<BookingCalendar | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const to = shiftDate(from, 6);

  const load = useCallback(async () => {
    setMessage(null);
    try {
      setCalendar(await getBookingCalendar(from, to));
    } catch {
      setMessage("排班日历加载失败，请稍后重试");
    }
  }, [from, to]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

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
        <div
          aria-label="七日预约日历"
          className="grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-px overflow-x-auto rounded-lg border bg-[#DED9D7]"
        >
          {calendar.days.map((day) => (
            <section className="min-w-0 bg-white" key={day.date}>
              <header className="sticky top-0 z-10 border-b bg-[#F5F3F2] px-3 py-3">
                <h2 className="font-sans font-semibold">{day.date}</h2>
                <p className="font-sans text-xs text-[#6E6968]">
                  {day.isClosed
                    ? "全天闭店"
                    : `${day.opensAt ?? "—"}–${day.closesAt ?? "—"}`}
                </p>
              </header>

              {day.specialHours && (
                <div className="border-b border-dashed border-[#D96F9E] px-3 py-2 text-xs">
                  {day.specialHours.isClosed
                    ? "全天特别闭店"
                    : `特别营业 ${day.specialHours.opensAt}–${day.specialHours.closesAt}`}
                  {day.specialHours.note ? ` · ${day.specialHours.note}` : ""}
                </div>
              )}

              {day.closures.map((closure) => (
                <div
                  className="border-b bg-[#F5F3F2] px-3 py-2 text-xs text-[#B5473F]"
                  key={closure.id}
                >
                  闭店 {closure.startTime ?? "全天"}
                  {closure.endTime ? `–${closure.endTime}` : ""}
                  {closure.note ? ` · ${closure.note}` : ""}
                </div>
              ))}

              <div className="divide-y">
                {day.intervals.map((interval) => (
                  <div
                    className={`min-h-14 px-3 py-2 ${
                      interval.closed
                        ? "bg-[repeating-linear-gradient(135deg,#F5F3F2,#F5F3F2_6px,#ECE8E6_6px,#ECE8E6_12px)]"
                        : ""
                    }`}
                    key={interval.startTime}
                  >
                    <div className="flex items-baseline justify-between gap-2 font-sans">
                      <span className="text-xs font-semibold text-[#6E6968]">
                        {interval.startTime}–{interval.endTime}
                      </span>
                      {interval.closed ? (
                        <span className="text-xs text-[#B5473F]">闭店</span>
                      ) : interval.partyBlocked ? (
                        <span className="text-xs font-semibold">派对占用</span>
                      ) : (
                        <span className="text-xs tabular-nums">
                          已到 {interval.ordinaryAttendance} / 8 · 剩余{" "}
                          {interval.remainingOrdinaryCapacity}
                        </span>
                      )}
                    </div>
                    {interval.ordinaryBookings.map((booking) => (
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
                ))}
              </div>

              {day.partyBlocks.map((party) => (
                <Link
                  className="m-3 block overflow-hidden rounded-md border border-[#D96F9E] text-xs focus-visible:outline-2"
                  href={`/admin/bookings/${party.bookingId}`}
                  key={party.bookingId}
                >
                  <div className="bg-[#F9E8EF] px-3 py-1.5">
                    准备 {party.setupStart}–{party.guestStart}
                  </div>
                  <div className="border-y border-[#D96F9E] bg-white px-3 py-2 font-semibold">
                    客人 {party.guestStart}–{party.guestEnd} · {party.name}
                  </div>
                  <div className="bg-[#F5F3F2] px-3 py-1.5">
                    收尾 {party.guestEnd}–{party.cleanupEnd}
                  </div>
                  {party.paymentDeadline && (
                    <div className="border-t px-3 py-1.5 text-[#B5473F]">
                      付款期限 {deadlineLabel(party.paymentDeadline)}
                    </div>
                  )}
                </Link>
              ))}

              {day.emailFailures.length > 0 && (
                <div className="m-3 border-l-2 border-[#B5473F] bg-[#FFF7F6] px-3 py-2 text-xs">
                  邮件失败{" "}
                  {day.emailFailures.reduce((sum, item) => sum + item.count, 0)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
