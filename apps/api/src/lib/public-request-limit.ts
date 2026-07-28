import type { FastifyReply } from "fastify";
import type Redis from "ioredis";
import { checkRateLimit } from "./cache.js";
import { AppError } from "./errors.js";

const PUBLIC_REQUEST_LIMIT = 5;
const PUBLIC_REQUEST_WINDOW_SECONDS = 3600;

export async function enforcePublicRequestLimit(
  redis: Redis | null,
  key: string,
  reply: Pick<FastifyReply, "header">,
): Promise<void> {
  const result = await checkRateLimit(
    redis,
    key,
    PUBLIC_REQUEST_LIMIT,
    PUBLIC_REQUEST_WINDOW_SECONDS,
  );

  if (!result.allowed) {
    reply.header("Retry-After", String(result.retryAfter ?? PUBLIC_REQUEST_WINDOW_SECONDS));
    throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
  }
}
