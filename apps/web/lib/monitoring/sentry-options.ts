export function sentryTraceSampleRate(value: string | undefined): number {
  if (!value?.trim()) return 0.05;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.05;
}

export function webSentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return {
    dsn: dsn || undefined,
    enabled: Boolean(dsn),
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: sentryTraceSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    ),
  };
}
