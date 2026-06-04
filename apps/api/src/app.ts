import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerErrorHandler } from "./plugins/error-handler.js";
import authPlugin from "./plugins/auth.js";
import dbPlugin from "./plugins/db.js";
import redisPlugin from "./plugins/redis.js";
import servicesPlugin from "./plugins/services.js";
import swaggerPlugin from "./plugins/swagger.js";
import healthRoutes from "./routes/health.routes.js";
import v1Routes from "./routes/v1/index.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  registerErrorHandler(app);

  await app.register(dbPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(servicesPlugin);
  await app.register(swaggerPlugin);
  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}
