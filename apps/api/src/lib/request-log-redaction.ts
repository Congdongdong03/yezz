type RequestForLog = { id: string; method: string; url: string };

const customerBookingPath =
  /^\/api\/v1\/customer-bookings\/[A-Za-z0-9_-]{43}(?:\/(?:accept-time|request-cancellation|request-reschedule))?(?:\?.*)?$/;

/** Keep bearer customer-management URLs out of default Fastify request logs. */
export function serializeRequestForLog(request: RequestForLog) {
  return {
    requestId: request.id,
    method: request.method,
    url: customerBookingPath.test(request.url)
      ? "/api/v1/customer-bookings/:token"
      : request.url,
  };
}
