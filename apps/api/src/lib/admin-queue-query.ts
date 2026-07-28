import type { OrderStatus } from "../repositories/bookings.repository.js";
import { parsePositiveInt } from "./validation.js";

const SEARCH_MAX_LENGTH = 200;
const ORDER_STATUSES: readonly OrderStatus[] = [
  "new",
  "contacted",
  "confirmed",
  "cancelled",
];

type RawQueueQuery = {
  page?: unknown;
  status?: unknown;
  search?: unknown;
  unread?: unknown;
  overdue?: unknown;
  confirmedToday?: unknown;
};

function parseBoolean(value: unknown): boolean {
  return value === "true" || value === true;
}

function parseStatus(value: unknown): OrderStatus | undefined {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : undefined;
}

function parseSearch(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, SEARCH_MAX_LENGTH);
  return trimmed || undefined;
}

export function parseAdminQueueQuery(query: RawQueueQuery) {
  return {
    page: parsePositiveInt(query.page, 1),
    status: parseStatus(query.status),
    search: parseSearch(query.search),
    unreadOnly: parseBoolean(query.unread),
    overdue: parseBoolean(query.overdue),
    confirmedToday: parseBoolean(query.confirmedToday),
  };
}
