import type { FastifyInstance } from "fastify";

export type HealthStatus = {
  status: "ok" | "degraded";
  db: "ok" | "error";
  redis: "ok" | "error" | "skipped";
};

export type OperationalHealthStatus = HealthStatus & {
  emailDelivery: "ok" | "error" | "unknown";
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

export async function getOperationalHealth(
  app: FastifyInstance,
): Promise<OperationalHealthStatus> {
  const base = await getHealth(app);
  if (base.db !== "ok") {
    return { ...base, status: "degraded", emailDelivery: "unknown" };
  }

  try {
    const [row] = await app.sql<
      { failedCount: number; stalledCount: number }[]
    >`
      SELECT
        count(*) FILTER (WHERE delivery_status = 'failed')::int AS "failedCount",
        count(*) FILTER (
          WHERE delivery_status IN ('pending', 'processing')
            AND created_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        )::int AS "stalledCount"
      FROM email_outbox
    `;
    const emailDelivery =
      row && row.failedCount === 0 && row.stalledCount === 0 ? "ok" : "error";
    return {
      ...base,
      status:
        base.status === "ok" && emailDelivery === "ok" ? "ok" : "degraded",
      emailDelivery,
    };
  } catch {
    return { ...base, status: "degraded", emailDelivery: "unknown" };
  }
}
