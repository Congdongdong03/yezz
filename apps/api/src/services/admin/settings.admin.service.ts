import {
  bookingPartyDetails,
  bookings,
  siteSettings,
  studioClosures,
  studioSpecialHours,
  studioWeeklyHours,
  type Db,
} from "@yezz/db";
import type Redis from "ioredis";
import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { CACHE_KEYS, cacheDel } from "../../lib/cache.js";
import { formatBookingOrderId } from "../../lib/email.js";
import { occupiesStudioSchedule } from "../../lib/schedule-occupancy.js";
import {
  BOOKING_HORIZON_CALENDAR_DAYS,
  getMelbourneClock,
  parseCalendarDate,
} from "../../lib/booking-policy.js";
import {
  createSettingsRepository,
  type SiteSettingsUpdateInput,
} from "../../repositories/settings.repository.js";
import { createBookingAvailabilityRepository } from "../../repositories/booking-availability.repository.js";
import {
  effectiveRequestCapabilities,
  readRequestCapabilities,
  type SiteSettingsDto,
} from "../settings.service.js";

type RequestSwitchEnvironment = Parameters<typeof readRequestCapabilities>[0];
type SettingsRow = NonNullable<
  Awaited<
    ReturnType<ReturnType<typeof createSettingsRepository>["findSingleton"]>
  >
>;

function toSettingsDto(
  row: SettingsRow,
  env: RequestSwitchEnvironment,
): SiteSettingsDto {
  return {
    id: row.id,
    storeName: row.storeName,
    address: row.address ?? null,
    businessHours: row.businessHours ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    wechatId: row.wechatId ?? null,
    wechatQrUrl: row.wechatQrUrl ?? null,
    heroImageUrl: row.heroImageUrl ?? null,
    instagram: row.instagram ?? null,
    xiaohongshu: row.xiaohongshu ?? null,
    googleMapUrl: row.googleMapUrl ?? null,
    seoTitle: row.seoTitle ?? null,
    seoDescription: row.seoDescription ?? null,
    requestCapabilities: effectiveRequestCapabilities(row, env),
  };
}

export type AdminSettingsService = ReturnType<typeof createAdminSettingsService>;

export function readEffectiveAdminSwitches(
  row: Pick<
    SettingsRow,
    | "experienceRequestsEnabled"
    | "partyRequestsEnabled"
    | "productRequestsEnabled"
  >,
  env: RequestSwitchEnvironment = process.env,
) {
  const deploymentHardGate = readRequestCapabilities(env);
  const database = {
    experience: row.experienceRequestsEnabled,
    party: row.partyRequestsEnabled,
    // Product cannot be opened during this rollout.
    product: false,
  };
  return {
    database,
    deploymentHardGate,
    effective: {
      experience: deploymentHardGate.experience && database.experience,
      party: deploymentHardGate.party && database.party,
      product: false,
    },
  };
}

export const DEFAULT_YEZYY_SITE_SETTINGS = {
  storeName: "YezYY",
  address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
  businessHours:
    "Monday 9:30 am–5:00 pm; Tuesday 9:30 am–5:00 pm; Wednesday 9:30 am–5:00 pm; Thursday 9:30 am–8:30 pm; Friday 9:30 am–8:30 pm; Saturday 9:30 am–5:30 pm; Sunday 10:00 am–5:00 pm",
  phone: "0430 787 712",
  email: "congdongdong03@gmail.com",
  wechatId: null,
  xiaohongshu: "95848743904",
  googleMapUrl:
    "https://www.google.com/maps/search/?api=1&query=G082%2F235%20Springvale%20Rd%2C%20Glen%20Waverley%20VIC%203150",
} as const;

const HH_MM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MILLISECONDS_PER_DAY = 86_400_000;

type ScheduleAcknowledgement = {
  fingerprint: string;
};
const SCHEDULE_CONFLICT_FINGERPRINT_SCHEMA_VERSION = 2;

function assertTimePair(
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
): asserts opensAt is string {
  if (
    !opensAt ||
    !closesAt ||
    !HH_MM.test(opensAt) ||
    !HH_MM.test(closesAt) ||
    opensAt >= closesAt
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "opening and closing times must be a valid increasing HH:MM pair",
    );
  }
}

function dateValue(value: string | Date): string {
  return typeof value === "string"
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

function operationalHorizon(now: Date): Array<{
  date: string;
  weekday: number;
}> {
  const today = parseCalendarDate(getMelbourneClock(now).date);
  return Array.from(
    { length: BOOKING_HORIZON_CALENDAR_DAYS + 1 },
    (_, offset) => {
      const instant = new Date(
        (today.ordinal + offset) * MILLISECONDS_PER_DAY,
      );
      return {
        date: instant.toISOString().slice(0, 10),
        weekday: instant.getUTCDay(),
      };
    },
  );
}

function overlaps(
  bookingStart: string | null,
  bookingEnd: string | null,
  closureStart: string | null,
  closureEnd: string | null,
): boolean {
  if (!bookingStart || !bookingEnd) return false;
  if (closureStart === null && closureEnd === null) return true;
  return (
    closureStart !== null &&
    closureEnd !== null &&
    bookingStart < closureEnd &&
    bookingEnd > closureStart
  );
}

function scheduleConflictFingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("base64url");
}

export function createAdminSettingsService(
  db: Db,
  redis: Redis | null = null,
  env: RequestSwitchEnvironment = process.env,
  dependencies?: { now?: () => Date },
) {
  const repo = createSettingsRepository(db);
  const availabilityRepo = createBookingAvailabilityRepository(db);
  const now = dependencies?.now ?? (() => new Date());

  async function lockStableOperationalHorizon(tx: Db) {
    const lockedDates = new Set<string>();
    while (true) {
      const snapshot = operationalHorizon(now());
      for (const { date } of snapshot) {
        if (!lockedDates.has(date)) {
          await availabilityRepo.lockOperationalDate(date, tx);
          lockedDates.add(date);
        }
      }
      const verified = operationalHorizon(now());
      if (verified.every(({ date }) => lockedDates.has(date))) {
        return verified;
      }
    }
  }

  async function settingsRow(
    connection: Db = db,
    lock?: "share" | "update",
  ): Promise<SettingsRow> {
    const connectionRepo =
      connection === db ? repo : createSettingsRepository(connection);
    let row = await connectionRepo.findSingleton(
      lock ? { lock } : undefined,
    );
    if (!row) {
      row = await connectionRepo.upsertSingleton(
        DEFAULT_YEZYY_SITE_SETTINGS,
      );
    }
    if (!row) {
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "Failed to initialize site settings",
      );
    }
    return row;
  }

  async function findAffectedBookingNumbers(
    date: string,
    startTime: string | null,
    endTime: string | null,
    connection: Db = db,
  ): Promise<string[]> {
    const scheduled = await connection
      .select({
        id: bookings.id,
        createdAt: bookings.createdAt,
        requestKind: bookings.requestKind,
        status: bookings.status,
        startTime: bookings.slotStartTime,
        endTime: bookings.slotEndTime,
      })
      .from(bookings)
      .where(eq(bookings.slotDate, date))
      .orderBy(asc(bookings.createdAt), asc(bookings.id));
    return scheduled
      .filter(
        (booking) =>
          occupiesStudioSchedule(booking.requestKind, booking.status) &&
          overlaps(
            booking.startTime,
            booking.endTime,
            startTime,
            endTime,
          ),
      )
      .map((booking) => formatBookingOrderId(booking.id, booking.createdAt));
  }

  async function completeScheduleFingerprintState(connection: Db) {
    const [weekly, specialHours, closures, bookingRows] = await Promise.all([
      connection.select().from(studioWeeklyHours).orderBy(asc(studioWeeklyHours.weekday)),
      connection.select().from(studioSpecialHours).orderBy(asc(studioSpecialHours.date)),
      connection.select().from(studioClosures).orderBy(asc(studioClosures.date), asc(studioClosures.startTime), asc(studioClosures.id)),
      connection.select({ id: bookings.id, createdAt: bookings.createdAt, requestKind: bookings.requestKind, status: bookings.status, date: bookings.slotDate, startTime: bookings.slotStartTime, endTime: bookings.slotEndTime }).from(bookings).orderBy(asc(bookings.createdAt), asc(bookings.id)),
    ]);
    return {
      weekly: weekly.map(({ weekday, opensAt, closesAt, isClosed }) => ({ weekday, opensAt, closesAt, isClosed })),
      specialHours: specialHours.map(({ date, opensAt, closesAt, isClosed, note }) => ({ date: dateValue(date), opensAt, closesAt, isClosed, note })),
      closures: closures.map(({ id, date, startTime, endTime, note }) => ({ id, date: dateValue(date), startTime, endTime, note })),
      bookings: bookingRows.filter((booking) => occupiesStudioSchedule(booking.requestKind, booking.status)).map((booking) => ({ id: booking.id, number: formatBookingOrderId(booking.id, booking.createdAt), date: dateValue(booking.date!), startTime: booking.startTime, endTime: booking.endTime, requestKind: booking.requestKind, status: booking.status })),
    };
  }

  async function findBookingsOutsideSpecialHours(
    date: string,
    opensAt: string,
    closesAt: string,
    connection: Db = db,
  ): Promise<string[]> {
    const scheduled = await connection
      .select({
        id: bookings.id,
        createdAt: bookings.createdAt,
        requestKind: bookings.requestKind,
        status: bookings.status,
        startTime: bookings.slotStartTime,
        endTime: bookings.slotEndTime,
        partyGuestStart: bookingPartyDetails.finalGuestStart,
        partyGuestEnd: bookingPartyDetails.finalGuestEnd,
      })
      .from(bookings)
      .leftJoin(
        bookingPartyDetails,
        eq(bookingPartyDetails.bookingId, bookings.id),
      )
      .where(eq(bookings.slotDate, date))
      .orderBy(asc(bookings.createdAt), asc(bookings.id));
    return scheduled
      .filter((booking) => {
        const publicStart =
          booking.requestKind === "party"
            ? (booking.partyGuestStart ?? booking.startTime)
            : booking.startTime;
        const publicEnd =
          booking.requestKind === "party"
            ? (booking.partyGuestEnd ?? booking.endTime)
            : booking.endTime;
        return (
          occupiesStudioSchedule(booking.requestKind, booking.status) &&
          !!publicStart &&
          !!publicEnd &&
          (publicStart < opensAt || publicEnd > closesAt)
        );
      })
      .map((booking) => formatBookingOrderId(booking.id, booking.createdAt));
  }

  function requireScheduleAcknowledgement(
    affectedBookingNumbers: string[],
    fingerprint: string,
    acknowledgement: ScheduleAcknowledgement | undefined,
  ) {
    if (
      affectedBookingNumbers.length > 0 &&
      acknowledgement?.fingerprint !== fingerprint
    ) {
      throwScheduleConflict(affectedBookingNumbers, fingerprint);
    }
  }

  function throwScheduleConflict(
    affectedBookingNumbers: string[],
    conflictFingerprint: string,
  ) {
    throw new AppError(
      409,
      "SCHEDULE_CONFLICT",
      "The schedule change affects active bookings",
      { affectedBookingNumbers, conflictFingerprint },
    );
  }

  return {
    async get(): Promise<SiteSettingsDto> {
      return toSettingsDto(await settingsRow(), env);
    },

    async update(input: SiteSettingsUpdateInput): Promise<SiteSettingsDto> {
      const updated = await repo.updateSingleton(input);
      if (!updated) {
        throw new AppError(404, "NOT_FOUND", "Site settings not configured");
      }
      await cacheDel(redis, CACHE_KEYS.settings);
      return toSettingsDto(updated, env);
    },

    async getSchedule() {
      const [weekly, specialHours, closures, row] = await Promise.all([
        db
          .select()
          .from(studioWeeklyHours)
          .orderBy(asc(studioWeeklyHours.weekday)),
        db
          .select()
          .from(studioSpecialHours)
          .orderBy(asc(studioSpecialHours.date)),
        db
          .select()
          .from(studioClosures)
          .orderBy(asc(studioClosures.date), asc(studioClosures.startTime)),
        settingsRow(),
      ]);
      return {
        timeZone: "Australia/Melbourne" as const,
        weekly,
        specialHours: specialHours.map((item) => ({
          ...item,
          date: dateValue(item.date),
        })),
        closures: closures.map((item) => ({
          ...item,
          date: dateValue(item.date),
        })),
        requestSwitches: readEffectiveAdminSwitches(row, env),
      };
    },

    async updateWeekly(input: {
      days: Array<{
        weekday: number;
        opensAt: string;
        closesAt: string;
        isClosed: boolean;
      }>;
      acknowledgement?: ScheduleAcknowledgement;
    }) {
      const days = input?.days;
      if (
        !Array.isArray(days) ||
        days.length !== 7 ||
        new Set(days.map(({ weekday }) => weekday)).size !== 7 ||
        days.some(
          ({ weekday }) =>
            !Number.isInteger(weekday) || weekday < 0 || weekday > 6,
        )
      ) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "weekly schedule must contain each weekday exactly once",
        );
      }
      for (const day of days) {
        assertTimePair(day.opensAt, day.closesAt);
      }
      await db.transaction(async (tx) => {
        await availabilityRepo.lockScheduleRevision(tx);
        const horizon = await lockStableOperationalHorizon(tx);
        const current = await tx
          .select()
          .from(studioWeeklyHours)
          .orderBy(asc(studioWeeklyHours.weekday));
        const currentByWeekday = new Map(
          current.map((day) => [day.weekday, day]),
        );
        const changedWeekdays = new Set(
          days
            .filter((day) => {
              const existing = currentByWeekday.get(day.weekday);
              return (
                !existing ||
                existing.opensAt !== day.opensAt ||
                existing.closesAt !== day.closesAt ||
                existing.isClosed !== day.isClosed
              );
            })
            .map(({ weekday }) => weekday),
        );
        const nextByWeekday = new Map(
          days.map((day) => [day.weekday, day]),
        );
        const affectedBookingNumbers: string[] = [];
        const relevantSpecialHours: Array<{
          date: string;
          special: {
            opensAt: string | null;
            closesAt: string | null;
            isClosed: boolean;
          } | null;
        }> = [];
        for (const { date, weekday } of horizon) {
          if (!changedWeekdays.has(weekday)) continue;
          const [special] = await tx
            .select({
              opensAt: studioSpecialHours.opensAt,
              closesAt: studioSpecialHours.closesAt,
              isClosed: studioSpecialHours.isClosed,
            })
            .from(studioSpecialHours)
            .where(eq(studioSpecialHours.date, date))
            .limit(1);
          relevantSpecialHours.push({ date, special: special ?? null });
          if (special) continue;
          const day = nextByWeekday.get(weekday)!;
          affectedBookingNumbers.push(
            ...(day.isClosed
              ? await findAffectedBookingNumbers(date, null, null, tx)
              : await findBookingsOutsideSpecialHours(
                  date,
                  day.opensAt,
                  day.closesAt,
                  tx,
                )),
          );
        }
        const affected = [...new Set(affectedBookingNumbers)];
        const completeState = await completeScheduleFingerprintState(tx);
        const fingerprint = scheduleConflictFingerprint({
          schemaVersion: SCHEDULE_CONFLICT_FINGERPRINT_SCHEMA_VERSION,
          kind: "weekly",
          affectedBookingNumbers: affected,
          currentWeekly: current.map((day) => ({
            weekday: day.weekday,
            opensAt: day.opensAt,
            closesAt: day.closesAt,
            isClosed: day.isClosed,
          })),
          nextWeekly: [...days]
            .sort((left, right) => left.weekday - right.weekday)
            .map((day) => ({
              weekday: day.weekday,
              opensAt: day.opensAt,
              closesAt: day.closesAt,
              isClosed: day.isClosed,
            })),
          relevantSpecialHours,
          completeState,
        });
        requireScheduleAcknowledgement(
          affected,
          fingerprint,
          input.acknowledgement,
        );
        for (const day of [...days].sort(
          (left, right) => left.weekday - right.weekday,
        )) {
          await tx
            .insert(studioWeeklyHours)
            .values(day)
            .onConflictDoUpdate({
              target: studioWeeklyHours.weekday,
              set: {
                opensAt: day.opensAt,
                closesAt: day.closesAt,
                isClosed: day.isClosed,
              },
            });
        }
      });
      return { weekly: days };
    },

    async upsertSpecialHours(input: {
      date: string;
      opensAt?: string | null;
      closesAt?: string | null;
      isClosed: boolean;
      note?: string | null;
      acknowledgement?: ScheduleAcknowledgement;
    }) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "date must use YYYY-MM-DD",
        );
      }
      const weekday = parseCalendarDate(input.date).weekday;
      if (input.isClosed) {
        if (input.opensAt || input.closesAt) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "full-day special closures cannot include opening times",
          );
        }
      } else {
        assertTimePair(input.opensAt, input.closesAt);
      }
      const row = await db.transaction(async (tx) => {
        await availabilityRepo.lockScheduleRevision(tx);
        await availabilityRepo.lockOperationalDate(input.date, tx);
        const [[currentWeekly], [currentSpecial]] = await Promise.all([
          tx
            .select({
              weekday: studioWeeklyHours.weekday,
              opensAt: studioWeeklyHours.opensAt,
              closesAt: studioWeeklyHours.closesAt,
              isClosed: studioWeeklyHours.isClosed,
            })
            .from(studioWeeklyHours)
            .where(eq(studioWeeklyHours.weekday, weekday))
            .limit(1),
          tx
            .select({
              opensAt: studioSpecialHours.opensAt,
              closesAt: studioSpecialHours.closesAt,
              isClosed: studioSpecialHours.isClosed,
            })
            .from(studioSpecialHours)
            .where(eq(studioSpecialHours.date, input.date))
            .limit(1),
        ]);
        const affected = input.isClosed
          ? await findAffectedBookingNumbers(input.date, null, null, tx)
          : await findBookingsOutsideSpecialHours(
              input.date,
              input.opensAt!,
              input.closesAt!,
              tx,
            );
        const completeState = await completeScheduleFingerprintState(tx);
        const fingerprint = scheduleConflictFingerprint({
          schemaVersion: SCHEDULE_CONFLICT_FINGERPRINT_SCHEMA_VERSION,
          kind: "special-hours",
          affectedBookingNumbers: affected,
          currentWeekly: currentWeekly ?? null,
          currentSpecial: currentSpecial ?? null,
          nextSpecial: {
            date: input.date,
            opensAt: input.isClosed ? null : input.opensAt!,
            closesAt: input.isClosed ? null : input.closesAt!,
            isClosed: input.isClosed,
          },
          completeState,
        });
        requireScheduleAcknowledgement(
          affected,
          fingerprint,
          input.acknowledgement,
        );
        const [updated] = await tx
          .insert(studioSpecialHours)
          .values({
            date: input.date,
            opensAt: input.isClosed ? null : input.opensAt!,
            closesAt: input.isClosed ? null : input.closesAt!,
            isClosed: input.isClosed,
            note: input.note?.trim() || null,
          })
          .onConflictDoUpdate({
            target: studioSpecialHours.date,
            set: {
              opensAt: input.isClosed ? null : input.opensAt!,
              closesAt: input.isClosed ? null : input.closesAt!,
              isClosed: input.isClosed,
              note: input.note?.trim() || null,
            },
          })
          .returning();
        return updated!;
      });
      return { ...row, date: dateValue(row.date) };
    },

    async createClosure(input: {
      date: string;
      startTime?: string | null;
      endTime?: string | null;
      note?: string | null;
      acknowledgement?: ScheduleAcknowledgement;
    }) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "date must use YYYY-MM-DD",
        );
      }
      const weekday = parseCalendarDate(input.date).weekday;
      const startTime = input.startTime ?? null;
      const endTime = input.endTime ?? null;
      if ((startTime === null) !== (endTime === null)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "partial closures require both startTime and endTime",
        );
      }
      if (startTime !== null) assertTimePair(startTime, endTime);

      const row = await db.transaction(async (tx) => {
        await availabilityRepo.lockScheduleRevision(tx);
        await availabilityRepo.lockOperationalDate(input.date, tx);
        const [[currentWeekly], [currentSpecial]] = await Promise.all([
          tx
            .select({
              weekday: studioWeeklyHours.weekday,
              opensAt: studioWeeklyHours.opensAt,
              closesAt: studioWeeklyHours.closesAt,
              isClosed: studioWeeklyHours.isClosed,
            })
            .from(studioWeeklyHours)
            .where(eq(studioWeeklyHours.weekday, weekday))
            .limit(1),
          tx
            .select({
              opensAt: studioSpecialHours.opensAt,
              closesAt: studioSpecialHours.closesAt,
              isClosed: studioSpecialHours.isClosed,
            })
            .from(studioSpecialHours)
            .where(eq(studioSpecialHours.date, input.date))
            .limit(1),
        ]);
        const affectedBookingNumbers = await findAffectedBookingNumbers(
          input.date,
          startTime,
          endTime,
          tx,
        );
        const completeState = await completeScheduleFingerprintState(tx);
        const fingerprint = scheduleConflictFingerprint({
          schemaVersion: SCHEDULE_CONFLICT_FINGERPRINT_SCHEMA_VERSION,
          kind: "closure",
          affectedBookingNumbers,
          currentWeekly: currentWeekly ?? null,
          currentSpecial: currentSpecial ?? null,
          nextClosure: { date: input.date, startTime, endTime },
          completeState,
        });
        requireScheduleAcknowledgement(
          affectedBookingNumbers,
          fingerprint,
          input.acknowledgement,
        );
        const [created] = await tx.insert(studioClosures).values({
          date: input.date,
          startTime,
          endTime,
          note: input.note?.trim() || null,
        }).returning();
        return created!;
      });
      return { ...row, date: dateValue(row.date) };
    },

    async deleteClosure(id: string) {
      const [row] = await db
        .delete(studioClosures)
        .where(eq(studioClosures.id, id))
        .returning({ id: studioClosures.id });
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "Closure not found");
      }
      return row;
    },

    async updateRequestSwitches(input: {
      experience?: boolean;
      party?: boolean;
      product?: boolean;
    }) {
      if (
        Object.values(input).some((value) => typeof value !== "boolean")
      ) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "request switches must be boolean",
        );
      }
      const switches = await db.transaction(async (tx) => {
        const row = await settingsRow(tx, "update");
        const [updated] = await tx
          .update(siteSettings)
          .set({
            ...(input.experience === undefined
              ? {}
              : { experienceRequestsEnabled: input.experience }),
            ...(input.party === undefined
              ? {}
              : { partyRequestsEnabled: input.party }),
            // Ignore attempts to turn product on and also repair stale true data.
            productRequestsEnabled: false,
            updatedAt: new Date(),
          })
          .where(eq(siteSettings.id, row.id))
          .returning();
        return readEffectiveAdminSwitches(updated!, env);
      });
      await cacheDel(redis, CACHE_KEYS.settings);
      return switches;
    },
  };
}
