import type { FastifyInstance } from "fastify";
import type { BookingCreateInput } from "../../repositories/bookings.repository.js";
import { success } from "../../lib/response.js";

export default async function bookingsRoutes(app: FastifyInstance) {
  app.post<{ Body: BookingCreateInput }>("/", async (request, reply) => {
    const data = await app.services.bookings.create(request.body);
    return reply.status(201).send(success(data));
  });
}
