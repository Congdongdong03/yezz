import type { FastifyInstance, FastifyReply } from "fastify";
import { AUTH_COOKIE_NAME } from "../../plugins/auth.js";
import { success } from "../../lib/response.js";
import { buildAuthCookieOptions } from "../../lib/auth-cookie.js";
import {
  enforceRateLimitResult,
  resolvePublicRateLimitSubject,
} from "../../lib/public-request-limit.js";
import type { RateLimitResult } from "../../services/rate-limits.service.js";

type LoginBody = {
  email?: string;
  password?: string;
};

const isProduction = process.env.NODE_ENV === "production";

function compareControllingLimit(
  left: RateLimitResult,
  right: RateLimitResult,
): number {
  if (left.allowed !== right.allowed) return left.allowed ? 1 : -1;

  if (!left.allowed) {
    const retryDifference =
      (right.retryAfter ?? right.resetAfter) -
      (left.retryAfter ?? left.resetAfter);
    if (retryDifference !== 0) return retryDifference;
  } else {
    const remainingDifference = left.remaining - right.remaining;
    if (remainingDifference !== 0) return remainingDifference;
  }

  const resetDifference = left.resetAfter - right.resetAfter;
  if (resetDifference !== 0) return resetDifference;
  return left.limit - right.limit;
}

function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie(
    AUTH_COOKIE_NAME,
    token,
    buildAuthCookieOptions(isProduction),
  );
}

function clearAuthCookie(reply: FastifyReply) {
  reply.clearCookie(AUTH_COOKIE_NAME, buildAuthCookieOptions(isProduction));
}

export default async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: LoginBody }>("/login", async (request, reply) => {
    const { email = "", password = "" } = request.body ?? {};
    const clientIp = resolvePublicRateLimitSubject(request);
    const normalizedEmail = email.normalize("NFKC").trim().toLowerCase();
    const [ipEmailLimit, ipLimit] = await Promise.all([
      app.services.rateLimits.consume(
        "login-ip-email",
        `${clientIp}\n${normalizedEmail}`,
        5,
        3600,
      ),
      app.services.rateLimits.consume("login-ip", clientIp, 30, 3600),
    ]);
    const controllingLimit = [ipEmailLimit, ipLimit].sort(
      compareControllingLimit,
    )[0]!;
    enforceRateLimitResult(controllingLimit, reply);

    const result = await app.services.auth.login(
      normalizedEmail,
      password,
      (payload) => request.server.jwt.sign(payload),
    );

    setAuthCookie(reply, result.token);

    return success({
      user: result.user,
    });
  });

  app.post("/logout", async (_request, reply) => {
    clearAuthCookie(reply);
    return success({ ok: true });
  });
}
