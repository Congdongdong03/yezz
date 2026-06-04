import fp from "fastify-plugin";
import Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

export default fp(async (app) => {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  let redis: Redis | null = null;

  try {
    redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    app.log.info("Redis connected");
  } catch (err) {
    app.log.warn({ err }, "Redis unavailable");
    redis = null;
  }

  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    await redis?.quit();
  });
});
