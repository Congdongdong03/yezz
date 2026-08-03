import { loadEnv } from "./env.js";
import {
  liveBookingLinksEnabled,
  parseBookingManagementBaseUrl,
} from "./lib/booking-notification-config.js";
import { initializeApiMonitoring } from "./lib/monitoring.js";

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
    "PASSWORD_SETUP_TOKEN_SECRET",
    "RESEND_API_KEY",
  ].filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Email outbox worker requires production configuration: ${missing.join(", ")}`,
    );
  }
  const passwordSetupTokenSecret = process.env.PASSWORD_SETUP_TOKEN_SECRET!;
  if (Buffer.byteLength(passwordSetupTokenSecret, "utf8") < 32) {
    throw new Error(
      "PASSWORD_SETUP_TOKEN_SECRET must be at least 32 bytes in production",
    );
  }
}

function validateBookingManagementConfiguration(): void {
  if (process.env.NODE_ENV !== "production" || !liveBookingLinksEnabled()) {
    return;
  }
  const tokenSecret = process.env.CUSTOMER_ACTION_TOKEN_SECRET;
  if (!tokenSecret || Buffer.byteLength(tokenSecret) < 32) {
    throw new Error(
      "Live booking paths require CUSTOMER_ACTION_TOKEN_SECRET of at least 32 bytes",
    );
  }
  if (tokenSecret === process.env.RESEND_API_KEY) {
    throw new Error(
      "CUSTOMER_ACTION_TOKEN_SECRET must differ from RESEND_API_KEY",
    );
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!parseBookingManagementBaseUrl(siteUrl, true)) {
    throw new Error(
      "Live booking paths require a safe production NEXT_PUBLIC_SITE_URL",
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
  initializeApiMonitoring();
  validateEmailOutboxConfiguration();
  validateBookingManagementConfiguration();
  return importApp();
}
