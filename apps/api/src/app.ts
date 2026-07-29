import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  registerInternalRequestProtection,
  resolveInternalRequestSecrets,
  type InternalRequestEnforcement,
} from "./lib/internal-request.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import authPlugin from "./plugins/auth.js";
import dbPlugin from "./plugins/db.js";
import redisPlugin from "./plugins/redis.js";
import servicesPlugin from "./plugins/services.js";
import swaggerPlugin from "./plugins/swagger.js";
import healthRoutes from "./routes/health.routes.js";
import v1Routes from "./routes/v1/index.js";
import {
  safeWorkerDiagnostic,
  startEmailOutboxWorker,
} from "./services/email-outbox.service.js";
import { startBookingMaintenanceWorker } from "./services/booking-maintenance.service.js";
import { serializeRequestForLog } from "./lib/request-log-redaction.js";

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
  const app = Fastify({
    logger: {
      serializers: {
        req: serializeRequestForLog,
      },
    },
  });

  const allowedOrigins = parseAllowedOrigins();
  const isProduction = process.env.NODE_ENV === "production";
  const internalRequestEnforcement =
    process.env.INTERNAL_REQUEST_ENFORCEMENT ?? "log";
  if (!["log", "require"].includes(internalRequestEnforcement)) {
    throw new Error("INTERNAL_REQUEST_ENFORCEMENT must be log or require");
  }
  registerInternalRequestProtection(app, {
    enforcement: internalRequestEnforcement as InternalRequestEnforcement,
    secrets: resolveInternalRequestSecrets(
      process.env.WEB_API_SHARED_SECRET,
      process.env.WEB_API_SHARED_SECRET_PREVIOUS,
    ),
  });

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

  if (process.env.EMAIL_OUTBOX_WORKER_ENABLED === "true") {
    const stopEmailWorker = startEmailOutboxWorker(
      app.services.emailOutbox,
      (error) =>
        app.log.error(
          { diagnostic: safeWorkerDiagnostic(error) },
          "Email outbox worker poll failed",
        ),
      {
        pollMilliseconds:
          process.env.NODE_ENV === "test"
            ? Number(process.env.EMAIL_OUTBOX_POLL_MILLISECONDS)
            : undefined,
      },
    );
    app.addHook("onClose", async () => {
      await stopEmailWorker();
    });
  }

  if (process.env.BOOKING_MAINTENANCE_WORKER_ENABLED === "true") {
    const stopBookingMaintenanceWorker = startBookingMaintenanceWorker(
      app.services.bookingMaintenance,
      (diagnostic) =>
        app.log.error(
          { diagnostic },
          "Booking maintenance worker poll failed",
        ),
      {
        pollMilliseconds:
          process.env.NODE_ENV === "test"
            ? Number(process.env.BOOKING_MAINTENANCE_POLL_MILLISECONDS)
            : undefined,
      },
    );
    app.addHook("onClose", async () => {
      await stopBookingMaintenanceWorker();
    });
  }

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
