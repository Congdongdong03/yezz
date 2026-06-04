import type { FastifyInstance, FastifyReply } from "fastify";
import { AUTH_COOKIE_NAME } from "../../plugins/auth.js";
import { success } from "../../lib/response.js";

type LoginBody = {
  email?: string;
  password?: string;
};

const isProduction = process.env.NODE_ENV === "production";

function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

function clearAuthCookie(reply: FastifyReply) {
  reply.clearCookie(AUTH_COOKIE_NAME, {
    path: "/",
    secure: isProduction,
    sameSite: "strict",
  });
}

export default async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: LoginBody }>("/login", async (request, reply) => {
    const { email = "", password = "" } = request.body ?? {};
    const result = await app.services.auth.login(email, password, (payload) =>
      request.server.jwt.sign(payload),
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
