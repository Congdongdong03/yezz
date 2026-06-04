import type { FastifyInstance } from "fastify";
import { getHealth } from "../services/health.service.js";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => getHealth(app));
}
