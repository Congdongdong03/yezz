import type { FastifyInstance } from "fastify";
import type { Db } from "@yezz/db";
import {
  enforceRequestLimit,
  resolvePublicRateLimitSubject,
} from "../../lib/public-request-limit.js";
import type { BookingCreateInput } from "../../repositories/bookings.repository.js";
import type { OrdinaryBookingCreateInput } from "../../lib/booking-workflow.js";
import type { PartyCreateInput } from "../../services/party-workflow.service.js";
import { AppError } from "../../lib/errors.js";
import { success } from "../../lib/response.js";
import { requireIdempotencyKey } from "../../lib/public-create-idempotency.js";

const BOOKING_RATE_LIMIT = 5;
const BOOKING_RATE_WINDOW_SECONDS = 3600;

function isOrdinaryRequest(
  input: BookingCreateInput | OrdinaryBookingCreateInput | PartyCreateInput | undefined,
): input is OrdinaryBookingCreateInput {
  return (
    input?.kind === "experience" &&
    "mode" in input &&
    "items" in input &&
    "participantCount" in input
  );
}

function isPartyRequest(
  input: BookingCreateInput | OrdinaryBookingCreateInput | PartyCreateInput | undefined,
): input is PartyCreateInput {
  return input?.kind === "party" && "birthdayChildName" in input;
}

export default async function bookingsRoutes(app: FastifyInstance) {
  app.post<{ Body: BookingCreateInput | OrdinaryBookingCreateInput | PartyCreateInput }>("/", async (request, reply) => {
    const capability = request.body?.kind ?? "experience";
    await app.services.settings.requirePublicRequestCapability(capability);

    const ordinaryRequest = isOrdinaryRequest(request.body);
    const partyRequest = isPartyRequest(request.body);
    if (!ordinaryRequest && !partyRequest) {
      throw new AppError(
        410,
        "LEGACY_BOOKING_FLOW_RETIRED",
        "This booking flow has been retired. Please use the current booking form.",
      );
    }

    const idempotencyKey = requireIdempotencyKey(
      request.headers["idempotency-key"],
    );
    const rateLimitSubject = resolvePublicRateLimitSubject(request);
    const consumeRequestLimit = (tx: Db) =>
      enforceRequestLimit(
        app.services.rateLimits,
        "booking",
        rateLimitSubject,
        BOOKING_RATE_LIMIT,
        BOOKING_RATE_WINDOW_SECONDS,
        reply,
        tx,
      );
    const data = partyRequest
      ? await app.services.bookings.createPartyRequest(
          request.body as PartyCreateInput,
          idempotencyKey,
          consumeRequestLimit,
        )
      : await app.services.bookings.create(
          request.body as OrdinaryBookingCreateInput,
          idempotencyKey,
          consumeRequestLimit,
        );
    return reply.status(201).send(success(data));
  });
}
