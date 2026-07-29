import type { UserRole as DatabaseUserRole } from "@yezz/db";

export type LegacyUserRole = "admin" | "staff";

export function legacyUserRoleFromDatabaseRole(
  role: DatabaseUserRole,
): LegacyUserRole {
  return role === "staff" ? "staff" : "admin";
}
