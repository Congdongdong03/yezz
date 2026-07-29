import type { FastifyReply } from "fastify";
import type { Db } from "@yezz/db";
import { isIP } from "node:net";
import { AppError } from "./errors.js";
import type { VerifiedClientIdentity } from "./internal-request.js";
import type {
  RateLimitResult,
  RateLimitsService,
} from "../services/rate-limits.service.js";

type PublicRateLimitRequest = {
  ip: string;
  verifiedClientIdentity: VerifiedClientIdentity | null;
};

type PublicRateLimitIdentityOptions = {
  nodeEnv: string | undefined;
  internalRequestEnforcement: string | undefined;
  allowLocalFallback: boolean;
};

function unavailable(): AppError {
  return new AppError(
    503,
    "RATE_LIMIT_UNAVAILABLE",
    "Please try again shortly.",
  );
}

function isLoopback(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("127.") ||
    normalized.startsWith("::ffff:127.")
  );
}

function canonicalIp(ip: string): string {
  const normalized = ip.trim().toLowerCase();
  const version = isIP(normalized);
  if (version === 4) return normalized;
  if (version === 6) {
    const hostname = new URL(`http://[${normalized}]/`).hostname;
    return hostname.slice(1, -1);
  }
  throw unavailable();
}

export function resolvePublicRateLimitSubject(
  request: PublicRateLimitRequest,
  options: PublicRateLimitIdentityOptions = {
    nodeEnv: process.env.NODE_ENV,
    internalRequestEnforcement:
      process.env.INTERNAL_REQUEST_ENFORCEMENT ?? "log",
    allowLocalFallback: process.env.RATE_LIMIT_ALLOW_LOCAL_FALLBACK === "1",
  },
): string {
  if (request.verifiedClientIdentity?.clientIp) {
    return canonicalIp(request.verifiedClientIdentity.clientIp);
  }

  if (
    options.nodeEnv !== "production" &&
    options.internalRequestEnforcement === "log" &&
    options.allowLocalFallback &&
    isLoopback(request.ip)
  ) {
    return canonicalIp(request.ip);
  }

  throw unavailable();
}

export async function enforceRequestLimit(
  service: RateLimitsService,
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
  reply: Pick<FastifyReply, "header">,
  connection?: Db,
): Promise<void> {
  const result = connection === undefined
    ? await service.consume(scope, subject, limit, windowSeconds)
    : await service.consume(scope, subject, limit, windowSeconds, connection);
  enforceRateLimitResult(result, reply);
}

export function enforceRateLimitResult(
  result: RateLimitResult,
  reply: Pick<FastifyReply, "header">,
): void {
  reply.header("RateLimit-Limit", String(result.limit));
  reply.header("RateLimit-Remaining", String(result.remaining));
  reply.header("RateLimit-Reset", String(result.resetAfter));

  if (!result.allowed) {
    reply.header("Retry-After", String(result.retryAfter ?? 1));
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please try again later.",
    );
  }
}
