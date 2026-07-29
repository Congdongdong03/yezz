import { loadEnv } from "./env.js";

function validateEmailOutboxConfiguration(): void {
  if (
    process.env.NODE_ENV !== "production" ||
    (process.env.EMAIL_OUTBOX_WORKER_ENABLED !== "true" &&
      process.env.BOOKING_MAINTENANCE_WORKER_ENABLED !== "true")
  ) {
    return;
  }
  const missing = [
    "EMAIL_FROM",
    "EMAIL_REPLY_TO",
    "OWNER_EMAIL",
    "RESEND_API_KEY",
  ].filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Email outbox worker requires production configuration: ${missing.join(", ")}`,
    );
  }
}

function validateBookingMaintenanceConfiguration(): void {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.BOOKING_MAINTENANCE_WORKER_ENABLED !== "true"
  ) {
    return;
  }
  const tokenSecret = process.env.CUSTOMER_ACTION_TOKEN_SECRET;
  if (!tokenSecret || Buffer.byteLength(tokenSecret) < 32) {
    throw new Error(
      "Booking maintenance worker requires CUSTOMER_ACTION_TOKEN_SECRET of at least 32 bytes",
    );
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let parsed: URL;
  try {
    if (!siteUrl) throw new Error("missing");
    parsed = new URL(siteUrl);
  } catch {
    throw new Error(
      "Booking maintenance worker requires a safe production NEXT_PUBLIC_SITE_URL",
    );
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "https:" ||
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.startsWith("127.")
  ) {
    throw new Error(
      "Booking maintenance worker requires a safe production NEXT_PUBLIC_SITE_URL",
    );
  }
}

/**
 * Load the repository environment before importing application modules.
 * Some modules validate their production configuration during evaluation.
 */
export async function loadConfiguredApp<T = typeof import("./app.js")>(
  importApp: () => Promise<T> = () => import("./app.js") as Promise<T>,
): Promise<T> {
  loadEnv();
  validateEmailOutboxConfiguration();
  validateBookingMaintenanceConfiguration();
  return importApp();
}
