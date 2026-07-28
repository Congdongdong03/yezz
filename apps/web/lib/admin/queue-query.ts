import type { AdminQueueListOptions, OrderStatus } from "./types";

const STATUSES: readonly OrderStatus[] = ["new", "contacted", "confirmed", "cancelled"];

export function parseAdminQueueSearchParams(params: { get?: (key: string) => string | null } | null | undefined): AdminQueueListOptions {
  const value = (key: string) => params?.get?.(key) ?? null;
  const pageValue = value("page");
  const statusValue = value("status");
  return {
    page: pageValue && /^\d+$/.test(pageValue) && Number(pageValue) > 0 ? Number(pageValue) : 1,
    status: statusValue && STATUSES.includes(statusValue as OrderStatus) ? (statusValue as OrderStatus) : undefined,
    search: value("search")?.trim().slice(0, 200) || undefined,
    unread: value("unread") === "true",
    overdue: value("overdue") === "true",
    confirmedToday: value("confirmedToday") === "true",
  };
}
