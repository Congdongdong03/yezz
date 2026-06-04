import type { FastifyInstance } from "fastify";
import { getHealth } from "../services/health.service.js";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    const health = await getHealth(app);
    if (health.status === "degraded") {
      reply.code(503);
    }
    return health;
  });
}
