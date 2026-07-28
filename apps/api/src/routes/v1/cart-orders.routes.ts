import type { FastifyInstance } from "fastify";
import {
  enforceRequestLimit,
  resolvePublicRateLimitSubject,
} from "../../lib/public-request-limit.js";
import type { CartOrderCreateInput } from "../../repositories/cart-orders.repository.js";
import { success } from "../../lib/response.js";

export default async function cartOrdersRoutes(app: FastifyInstance) {
  app.post<{ Body: CartOrderCreateInput }>("/", async (request, reply) => {
    await enforceRequestLimit(
      app.services.rateLimits,
      "cart-order",
      resolvePublicRateLimitSubject(request),
      5,
      3600,
      reply,
    );
    const data = await app.services.cartOrders.create(request.body);
    return reply.status(201).send(success(data));
  });
}
