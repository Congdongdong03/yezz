import {
  studioClosures,
  studioSpecialHours,
  studioWeeklyHours,
  type Db,
} from "@yezz/db";
import { asc, eq } from "drizzle-orm";
import { parseCalendarDate } from "../lib/slot-policy.js";

export type ResolvedStudioDay = {
  date: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  closures: Array<{ startTime: string | null; endTime: string | null }>;
};

function dateValue(value: string | Date): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export function createStudioScheduleRepository(db: Db) {
  return {
    async resolveDay(date: string): Promise<ResolvedStudioDay> {
      const { weekday } = parseCalendarDate(date);
      const [[special], [weekly], closureRows] = await Promise.all([
        db.select().from(studioSpecialHours).where(eq(studioSpecialHours.date, date)).limit(1),
        db.select().from(studioWeeklyHours).where(eq(studioWeeklyHours.weekday, weekday)).limit(1),
        db.select({ startTime: studioClosures.startTime, endTime: studioClosures.endTime })
          .from(studioClosures)
          .where(eq(studioClosures.date, date))
          .orderBy(asc(studioClosures.startTime)),
      ]);
      const hours = special ?? weekly;
      const closures = closureRows.map((closure) => ({
        startTime: closure.startTime ?? null,
        endTime: closure.endTime ?? null,
      }));
      const wholeDayClosure = closures.some(
        (closure) => closure.startTime === null && closure.endTime === null,
      );

      return {
        date,
        isClosed: Boolean(hours?.isClosed) || wholeDayClosure || !hours,
        opensAt: hours && !hours.isClosed ? hours.opensAt : null,
        closesAt: hours && !hours.isClosed ? hours.closesAt : null,
        closures,
      };
    },
  };
}

export { dateValue as studioScheduleDateValue };
