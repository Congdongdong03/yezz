import type { FastifyInstance } from "fastify";
import { getHealth, getOperationalHealth } from "../services/health.service.js";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    const health = await getHealth(app);
    if (health.status === "degraded") {
      reply.code(503);
    }
    return health;
  });

  app.get("/health/operations", async (_request, reply) => {
    const health = await getOperationalHealth(app);
    if (health.status === "degraded") {
      reply.code(503);
    }
    return health;
  });
}
