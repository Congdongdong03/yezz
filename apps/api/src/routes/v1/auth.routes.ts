import type { FastifyInstance, FastifyReply } from "fastify";
import { AUTH_COOKIE_NAME } from "../../plugins/auth.js";
import { success } from "../../lib/response.js";
import { buildAuthCookieOptions } from "../../lib/auth-cookie.js";
import {
  enforceRateLimitResult,
  resolvePublicRateLimitSubject,
} from "../../lib/public-request-limit.js";

type LoginBody = {
  email?: string;
  password?: string;
};

const isProduction = process.env.NODE_ENV === "production";

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
    const denied = [ipEmailLimit, ipLimit]
      .filter((result) => !result.allowed)
      .sort(
        (left, right) => (right.retryAfter ?? 0) - (left.retryAfter ?? 0),
      )[0];
    enforceRateLimitResult(denied ?? ipEmailLimit, reply);

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
