import type { FastifyInstance } from "fastify";
import {
  enforceRequestLimit,
  resolvePublicRateLimitSubject,
} from "../../lib/public-request-limit.js";
import type { BookingCreateInput } from "../../repositories/bookings.repository.js";
import { success } from "../../lib/response.js";

const BOOKING_RATE_LIMIT = 5;
const BOOKING_RATE_WINDOW_SECONDS = 3600;

export default async function bookingsRoutes(app: FastifyInstance) {
  app.post<{ Body: BookingCreateInput }>("/", async (request, reply) => {
    await enforceRequestLimit(
      app.services.rateLimits,
      "booking",
      resolvePublicRateLimitSubject(request),
      BOOKING_RATE_LIMIT,
      BOOKING_RATE_WINDOW_SECONDS,
      reply,
    );

    const idempotencyHeader = request.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(idempotencyHeader)
      ? idempotencyHeader[0]
      : idempotencyHeader;
    const data = await app.services.bookings.create(
      request.body,
      idempotencyKey,
    );
    return reply.status(201).send(success(data));
  });
}
