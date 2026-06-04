import type { FastifyInstance } from "fastify";
import type { CartOrderCreateInput } from "../../repositories/cart-orders.repository.js";
import { success } from "../../lib/response.js";

export default async function cartOrdersRoutes(app: FastifyInstance) {
  app.post<{ Body: CartOrderCreateInput }>("/", async (request, reply) => {
    const data = await app.services.cartOrders.create(request.body);
    return reply.status(201).send(success(data));
  });
}
