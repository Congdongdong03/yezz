import type { OrderStatus } from "./types";

export function requiresCustomerNote(status: OrderStatus) {
  return status === "confirmed" || status === "cancelled";
}
