export type BookingNotificationEnvironment = Record<
  string,
  string | undefined
>;

export function liveBookingLinksEnabled(
  environment: BookingNotificationEnvironment = process.env,
): boolean {
  return [
    "EMAIL_OUTBOX_WORKER_ENABLED",
    "BOOKING_MAINTENANCE_WORKER_ENABLED",
    "REQUEST_FLOW_EXPERIENCE_ENABLED",
    "REQUEST_FLOW_PARTY_ENABLED",
  ].some((name) => environment[name] === "true");
}

export function parseBookingManagementBaseUrl(
  value: string | undefined,
  production: boolean,
): URL | null {
  let parsed: URL;
  try {
    if (!value?.trim()) return null;
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (production) {
    const hostname = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.startsWith("127.")
    ) {
      return null;
    }
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}
