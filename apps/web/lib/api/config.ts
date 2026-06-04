/** When true, project pages read from the Node API instead of Sanity/mock. */
export function isApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_API === "true";
}

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}
