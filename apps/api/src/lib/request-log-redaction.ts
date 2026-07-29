type RequestForLog = { id: string; method: string; url: string };

const customerBookingPrefix = "/api/v1/customer-bookings/";
const customerBookingToken = /^[A-Za-z0-9_-]{43}$/;
const customerBookingActionPaths = new Set([
  "",
  "/accept-time",
  "/request-cancellation",
  "/request-reschedule",
]);
const sensitiveQueryKey =
  /(?:token|secret|signature|password|authorization|api[_-]?key)/i;
const redactedComponent = "[REDACTED]";

function decodedComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function customerBookingPathMatch(
  rawPath: string,
): { redactedPath: string; isStrictCustomerAction: boolean } | null {
  if (!rawPath.startsWith(customerBookingPrefix)) return null;

  const remainder = rawPath.slice(customerBookingPrefix.length);
  const suffixStart = remainder.indexOf("/");
  const rawToken =
    suffixStart === -1 ? remainder : remainder.slice(0, suffixStart);
  const token = decodedComponent(rawToken);
  const rawSuffix = suffixStart === -1 ? "" : remainder.slice(suffixStart);
  const decodedSuffix = decodedComponent(rawSuffix);
  const normalizedSuffix = decodedSuffix?.replace(/\/+$/, "");
  const isStrictCustomerAction =
    token !== null &&
    customerBookingToken.test(token) &&
    normalizedSuffix !== undefined &&
    customerBookingActionPaths.has(normalizedSuffix);

  return {
    redactedPath: isStrictCustomerAction
      ? `${customerBookingPrefix}:token${normalizedSuffix}`
      : `${customerBookingPrefix}:token/${redactedComponent}`,
    isStrictCustomerAction,
  };
}

/** Match raw or percent-encoded customer bearer paths used by request protection. */
export function isCustomerBookingRequestPath(url: string): boolean {
  const rawPath = url.split("?", 1)[0] ?? "";
  return customerBookingPathMatch(rawPath)?.isStrictCustomerAction ?? false;
}

function safeQuery(query: string): string {
  if (!query) return "";
  return query
    .split("&")
    .map((entry) => {
      const [key, value] = entry.split("=", 2);
      if (!key) return "";
      const decodedKey = decodedComponent(key);
      const decodedValue =
        value === undefined ? undefined : decodedComponent(value);
      if (decodedKey === null || decodedValue === null)
        return redactedComponent;
      if (
        customerBookingToken.test(decodedKey) ||
        (decodedValue !== undefined && customerBookingToken.test(decodedValue))
      ) {
        return redactedComponent;
      }
      return sensitiveQueryKey.test(decodedKey)
        ? `${key}=${redactedComponent}`
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
  const path = customerBookingPathMatch(rawPath)?.redactedPath ?? rawPath;
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
