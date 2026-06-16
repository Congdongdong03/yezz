import fp from "fastify-plugin";
import Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

export default fp(async (app) => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    app.log.info("REDIS_URL not set, skipping Redis");
    app.decorate("redis", null);
    return;
  }

  let redis: Redis | null = null;

  try {
    redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    app.log.info("Redis connected");
  } catch (err) {
    app.log.warn({ err }, "Redis unavailable, running without cache");
    redis = null;
  }

  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    await redis?.quit();
  });
});
