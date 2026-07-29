import type { FastifyInstance } from "fastify";
import {
  enforceRequestLimit,
  resolvePublicRateLimitSubject,
} from "../../lib/public-request-limit.js";
import type { BookingCreateInput } from "../../repositories/bookings.repository.js";
import type { OrdinaryBookingCreateInput } from "../../lib/booking-workflow.js";
import type { PartyCreateInput } from "../../services/party-workflow.service.js";
import { success } from "../../lib/response.js";
import { requireIdempotencyKey } from "../../lib/public-create-idempotency.js";
import { requireRequestCapability } from "../../services/settings.service.js";

const BOOKING_RATE_LIMIT = 5;
const BOOKING_RATE_WINDOW_SECONDS = 3600;

export default async function bookingsRoutes(app: FastifyInstance) {
  app.post<{ Body: BookingCreateInput | OrdinaryBookingCreateInput | PartyCreateInput }>("/", async (request, reply) => {
    requireRequestCapability(request.body?.kind ?? "experience");

    await enforceRequestLimit(
      app.services.rateLimits,
      "booking",
      resolvePublicRateLimitSubject(request),
      BOOKING_RATE_LIMIT,
      BOOKING_RATE_WINDOW_SECONDS,
      reply,
    );

    const idempotencyKey = requireIdempotencyKey(
      request.headers["idempotency-key"],
    );
    const data = request.body?.kind === "party" && "birthdayChildName" in request.body
      ? await app.services.bookings.createPartyRequest(request.body, idempotencyKey)
      : await app.services.bookings.create(request.body as BookingCreateInput | OrdinaryBookingCreateInput, idempotencyKey);
    return reply.status(201).send(success(data));
  });
}
