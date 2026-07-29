import {
  bookings,
  siteSettings,
  studioClosures,
  studioSpecialHours,
  studioWeeklyHours,
  type Db,
} from "@yezz/db";
import type Redis from "ioredis";
import { asc, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { CACHE_KEYS, cacheDel } from "../../lib/cache.js";
import { formatBookingOrderId } from "../../lib/email.js";
import {
  createSettingsRepository,
  type SiteSettingsUpdateInput,
} from "../../repositories/settings.repository.js";
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
const ACTIVE_PARTY_STATUSES = new Set([
  "awaiting_in_store_payment",
  "confirmed_paid",
  "confirmed",
]);

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

export function createAdminSettingsService(
  db: Db,
  redis: Redis | null = null,
  env: RequestSwitchEnvironment = process.env,
) {
  const repo = createSettingsRepository(db);

  async function settingsRow(): Promise<SettingsRow> {
    let row = await repo.findSingleton();
    if (!row) {
      row = await repo.upsertSingleton(DEFAULT_YEZYY_SITE_SETTINGS);
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
  ): Promise<string[]> {
    const scheduled = await db
      .select({
        id: bookings.id,
        createdAt: bookings.createdAt,
        requestKind: bookings.requestKind,
        status: bookings.status,
        startTime: bookings.slotStartTime,
        endTime: bookings.slotEndTime,
      })
      .from(bookings)
      .where(eq(bookings.slotDate, date));
    return scheduled
      .filter(
        (booking) =>
          ((booking.requestKind === "experience" &&
            booking.status === "confirmed") ||
            (booking.requestKind === "party" &&
              ACTIVE_PARTY_STATUSES.has(booking.status))) &&
          overlaps(
            booking.startTime,
            booking.endTime,
            startTime,
            endTime,
          ),
      )
      .map((booking) => formatBookingOrderId(booking.id, booking.createdAt));
  }

  function throwScheduleConflict(affectedBookingNumbers: string[]) {
    throw new AppError(
      409,
      "SCHEDULE_CONFLICT",
      "The closure overlaps active bookings",
      { affectedBookingNumbers },
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

    async updateWeekly(
      days: Array<{
        weekday: number;
        opensAt: string;
        closesAt: string;
        isClosed: boolean;
      }>,
    ) {
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
        for (const day of days) {
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
      acknowledgeExistingBookings?: boolean;
    }) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "date must use YYYY-MM-DD",
        );
      }
      if (input.isClosed) {
        if (input.opensAt || input.closesAt) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "full-day special closures cannot include opening times",
          );
        }
        const affected = await findAffectedBookingNumbers(input.date, null, null);
        if (
          affected.length > 0 &&
          input.acknowledgeExistingBookings !== true
        ) {
          throwScheduleConflict(affected);
        }
      } else {
        assertTimePair(input.opensAt, input.closesAt);
      }
      const [row] = await db
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
      return { ...row!, date: dateValue(row!.date) };
    },

    async createClosure(input: {
      date: string;
      startTime?: string | null;
      endTime?: string | null;
      note?: string | null;
      acknowledgeExistingBookings?: boolean;
    }) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "date must use YYYY-MM-DD",
        );
      }
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

      const affectedBookingNumbers = await findAffectedBookingNumbers(
        input.date,
        startTime,
        endTime,
      );
      if (
        affectedBookingNumbers.length > 0 &&
        input.acknowledgeExistingBookings !== true
      ) {
        throwScheduleConflict(affectedBookingNumbers);
      }

      const [row] = await db
        .insert(studioClosures)
        .values({
          date: input.date,
          startTime,
          endTime,
          note: input.note?.trim() || null,
        })
        .returning();
      return { ...row!, date: dateValue(row!.date) };
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
      const row = await settingsRow();
      const [updated] = await db
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
      await cacheDel(redis, CACHE_KEYS.settings);
      return readEffectiveAdminSwitches(updated!, env);
    },
  };
}
