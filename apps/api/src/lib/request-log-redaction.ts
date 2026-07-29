type RequestForLog = { id: string; method: string; url: string };

const customerBookingPath =
  /^(\/api\/v1\/customer-bookings\/)\b[A-Za-z0-9_-]{43}\b/;
const sensitiveQueryKey =
  /(?:token|secret|signature|password|authorization|api[_-]?key)/i;

function safeQuery(query: string): string {
  if (!query) return "";
  return query
    .split("&")
    .map((entry) => {
      const [key, value] = entry.split("=", 2);
      if (!key) return "";
      return sensitiveQueryKey.test(decodeURIComponent(key))
        ? `${key}=[REDACTED]`
        : value === undefined
          ? key
          : `${key}=${value}`;
    })
    .filter(Boolean)
    .join("&");
}

/** Redact bearer path segments while retaining non-sensitive query evidence. */
export function safeRequestUrl(url: string): string {
  const [rawPath, rawQuery = ""] = url.split("?", 2);
  const path = rawPath.replace(customerBookingPath, "$1:token");
  const query = safeQuery(rawQuery);
  return query ? `${path}?${query}` : path;
}

/** Keep bearer customer-management URLs out of default Fastify request logs. */
export function serializeRequestForLog(request: RequestForLog) {
  return {
    requestId: request.id,
    method: request.method,
    url: safeRequestUrl(request.url),
  };
}
