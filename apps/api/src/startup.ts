import { loadEnv } from "./env.js";

function validateEmailOutboxConfiguration(): void {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.EMAIL_OUTBOX_WORKER_ENABLED !== "true"
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

/**
 * Load the repository environment before importing application modules.
 * Some modules validate their production configuration during evaluation.
 */
export async function loadConfiguredApp<T = typeof import("./app.js")>(
  importApp: () => Promise<T> = () => import("./app.js") as Promise<T>,
): Promise<T> {
  loadEnv();
  validateEmailOutboxConfiguration();
  return importApp();
}
