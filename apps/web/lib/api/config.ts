/** When true, project pages read from the Node API instead of Sanity/mock. */
export function isApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_API === "true";
}

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_USE_API !== "true"
) {
  console.warn(
    "[YEZZ] NEXT_PUBLIC_USE_API is not true in production — the site will show mock data instead of the live API.",
  );
}
