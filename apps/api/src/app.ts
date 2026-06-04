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

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Dev-only: allow common local front-end origins on port 3000. */
function isDevLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):3000$/.test(
    origin,
  );
}

export async function buildApp() {
  const app = Fastify({ logger: true });

  const allowedOrigins = parseAllowedOrigins();
  const isProduction = process.env.NODE_ENV === "production";

  await app.register(cors, {
    origin(origin, cb) {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        cb(null, origin);
        return;
      }
      if (!isProduction && isDevLocalOrigin(origin)) {
        cb(null, origin);
        return;
      }
      cb(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  registerErrorHandler(app);

  await app.register(dbPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(servicesPlugin);
  await app.register(swaggerPlugin);
  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: "/api/v1" });

  // Purge expired cart sessions daily
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const purgeTimer = setInterval(async () => {
    try {
      await app.services.cartSessions.purgeExpired();
    } catch (err) {
      app.log.error({ err }, "Failed to purge expired cart sessions");
    }
  }, TWENTY_FOUR_HOURS);
  app.addHook("onClose", () => clearInterval(purgeTimer));

  return app;
}
