import type { FastifyInstance } from "fastify";

export type HealthStatus = {
  status: "ok" | "degraded";
  db: "ok" | "error";
  redis: "ok" | "error" | "skipped";
};

export async function getHealth(app: FastifyInstance): Promise<HealthStatus> {
  let dbStatus: "ok" | "error" = "error";
  let redisStatus: "ok" | "error" | "skipped" = "skipped";

  try {
    await app.sql`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  if (app.redis) {
    try {
      await app.redis.ping();
      redisStatus = "ok";
    } catch {
      redisStatus = "error";
    }
  }

  return {
    status: dbStatus === "ok" && redisStatus !== "error" ? "ok" : "degraded",
    db: dbStatus,
    redis: redisStatus,
  };
}
