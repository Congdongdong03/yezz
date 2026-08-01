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

type SetupPasswordBody = {
  token?: unknown;
  newPassword?: unknown;
};

type ForgotPasswordBody = {
  email?: unknown;
};

const isProduction = process.env.NODE_ENV === "production";
const PASSWORD_RECOVERY_MIN_RESPONSE_MILLISECONDS = 500;

async function waitForPasswordRecoveryFloor(startedAt: number): Promise<void> {
  const remaining =
    PASSWORD_RECOVERY_MIN_RESPONSE_MILLISECONDS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

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
  app.post<{ Body: ForgotPasswordBody }>(
    "/forgot-password",
    async (request, reply) => {
      const startedAt = Date.now();
      const body = request.body ?? {};
      const normalizedEmail =
        typeof body.email === "string"
          ? body.email.normalize("NFKC").trim().toLowerCase()
          : "";
      const clientIp = resolvePublicRateLimitSubject(request);
      const [ipEmailLimit, ipLimit] = await Promise.all([
        app.services.rateLimits.consume(
          "password-recovery-ip-email",
          `${clientIp}\n${normalizedEmail}`,
          3,
          3600,
        ),
        app.services.rateLimits.consume(
          "password-recovery-ip",
          clientIp,
          10,
          3600,
        ),
      ]);
      const controllingLimit = [ipEmailLimit, ipLimit].sort(
        compareControllingLimit,
      )[0]!;
      enforceRateLimitResult(controllingLimit, reply);

      try {
        try {
          await app.services.passwordSetup.requestForEmail(normalizedEmail);
        } catch (error) {
          request.log.warn(
            { error },
            "password recovery request could not be queued",
          );
        }
      } finally {
        await waitForPasswordRecoveryFloor(startedAt);
      }

      return success({ ok: true as const });
    },
  );

  app.post<{ Body: SetupPasswordBody }>(
    "/setup-password",
    async (request, reply) => {
      const clientIp = resolvePublicRateLimitSubject(request);
      const limit = await app.services.rateLimits.consume(
        "password-setup-ip",
        clientIp,
        10,
        3600,
      );
      enforceRateLimitResult(limit, reply);
      const body = request.body ?? {};
      return success(
        await app.services.passwordSetup.complete(
          body.token,
          body.newPassword,
        ),
      );
    },
  );

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
