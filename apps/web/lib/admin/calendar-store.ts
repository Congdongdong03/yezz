import type {
  BookingCalendar,
  BookingCalendarDay,
} from "@/lib/admin/types";

const days = new Map<string, BookingCalendarDay>();
const listeners = new Set<() => void>();

export function cacheBookingCalendar(calendar: BookingCalendar): void {
  for (const day of calendar.days) {
    days.set(day.date, day);
  }
  for (const listener of listeners) listener();
}

export function readCachedBookingCalendarDay(
  date: string,
): BookingCalendarDay | undefined {
  return days.get(date);
}

export function mergeCachedBookingCalendar(
  calendar: BookingCalendar,
): BookingCalendar {
  return {
    ...calendar,
    days: calendar.days.map((day) => days.get(day.date) ?? day),
  };
}

export function subscribeBookingCalendar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
