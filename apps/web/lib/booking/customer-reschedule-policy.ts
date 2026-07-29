export const CUSTOMER_RESCHEDULE_TIME_ZONE = "Australia/Melbourne";
export const CUSTOMER_RESCHEDULE_HORIZON_DAYS = 7;
export const CUSTOMER_RESCHEDULE_MINIMUM_LEAD_MINUTES = 120;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HALF_HOUR_TIME = /^(?:[01]\d|2[0-3]):(?:00|30)$/;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 86_400_000;

type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CUSTOMER_RESCHEDULE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function localDateTime(instant: Date | number): LocalDateTime {
  const values = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

function parseDate(date: string): LocalDateTime | null {
  const match = ISO_DATE.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (
    instant.getUTCFullYear() !== year ||
    instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day, hour: 0, minute: 0 };
}

function ordinal(date: Pick<LocalDateTime, "year" | "month" | "day">): number {
  return Math.floor(
    Date.UTC(date.year, date.month - 1, date.day) / MILLISECONDS_PER_DAY,
  );
}

function formatOrdinal(value: number): string {
  return new Date(value * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

function offsetAt(instantMs: number): number {
  const local = localDateTime(instantMs);
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  const instantAtMinute =
    Math.floor(instantMs / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE;
  return localAsUtc - instantAtMinute;
}

function matchingInstant(
  local: LocalDateTime,
): number | null {
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    offsets.add(offsetAt(localAsUtc + hours * 60 * MILLISECONDS_PER_MINUTE));
  }

  const matches = [...offsets]
    .map((offset) => localAsUtc - offset)
    .filter((instant) => {
      const candidate = localDateTime(instant);
      return (
        candidate.year === local.year &&
        candidate.month === local.month &&
        candidate.day === local.day &&
        candidate.hour === local.hour &&
        candidate.minute === local.minute
      );
    });

  return matches.length === 1 ? matches[0] : null;
}

export function getCustomerRescheduleDateBounds(
  now: Date = new Date(),
): { min: string; max: string } {
  const today = localDateTime(now);
  const todayOrdinal = ordinal(today);
  return {
    min: formatOrdinal(todayOrdinal),
    max: formatOrdinal(todayOrdinal + CUSTOMER_RESCHEDULE_HORIZON_DAYS),
  };
}

export function validateCustomerRescheduleRequest(
  input: { date: string; startTime: string },
  now: Date = new Date(),
): { valid: boolean } {
  const date = parseDate(input.date);
  if (!date || !HALF_HOUR_TIME.test(input.startTime)) {
    return { valid: false };
  }

  const [hour, minute] = input.startTime.split(":").map(Number);
  const requested = { ...date, hour, minute };
  const today = localDateTime(now);
  const calendarDays = ordinal(requested) - ordinal(today);
  if (
    calendarDays < 0 ||
    calendarDays > CUSTOMER_RESCHEDULE_HORIZON_DAYS
  ) {
    return { valid: false };
  }

  const requestedInstant = matchingInstant(requested);
  if (
    requestedInstant === null ||
    requestedInstant - now.getTime() <
      CUSTOMER_RESCHEDULE_MINIMUM_LEAD_MINUTES * MILLISECONDS_PER_MINUTE
  ) {
    return { valid: false };
  }

  return { valid: true };
}
