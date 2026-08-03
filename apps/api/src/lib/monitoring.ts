import * as Sentry from "@sentry/node";

function traceSampleRate(value: string | undefined): number {
  const parsed = Number(value);
  return value?.trim() && Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : 0.05;
}

export function initializeApiMonitoring(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  Sentry.init({
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: traceSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
  });
}

export function captureApiException(
  error: unknown,
  request: { method: string; routeOptions?: { url?: string } },
): void {
  if (!Sentry.isEnabled()) return;
  Sentry.withScope((scope) => {
    scope.setTag("http.method", request.method);
    scope.setTag("http.route", request.routeOptions?.url ?? "unknown");
    Sentry.captureException(error);
  });
}
