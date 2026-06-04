import type { FastifyInstance } from "fastify";
import { checkRateLimit } from "../../lib/cache.js";
import { AppError } from "../../lib/errors.js";
import type { BookingCreateInput } from "../../repositories/bookings.repository.js";
import { success } from "../../lib/response.js";

const BOOKING_RATE_LIMIT = 5;
const BOOKING_RATE_WINDOW_SECONDS = 3600;

export default async function bookingsRoutes(app: FastifyInstance) {
  app.post<{ Body: BookingCreateInput }>("/", async (request, reply) => {
    const ip = request.ip;
    const rateKey = `ratelimit:bookings:${ip}`;
    const { allowed, retryAfter } = await checkRateLimit(
      app.redis,
      rateKey,
      BOOKING_RATE_LIMIT,
      BOOKING_RATE_WINDOW_SECONDS,
    );

    if (!allowed) {
      throw new AppError(
        429,
        "RATE_LIMITED",
        `Too many booking requests. Try again in ${retryAfter ?? BOOKING_RATE_WINDOW_SECONDS} seconds.`,
      );
    }

    const data = await app.services.bookings.create(request.body);
    return reply.status(201).send(success(data));
  });
}
