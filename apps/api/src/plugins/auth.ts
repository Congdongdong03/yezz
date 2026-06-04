import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { AppError } from "../lib/errors.js";
import type { JwtPayload, UserRole } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    requireAdmin: (request: FastifyRequest) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export const AUTH_COOKIE_NAME = "token";

export default fp(async (app) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  await app.register(cookie);

  await app.register(jwt, {
    secret,
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN ?? "24h",
    },
    cookie: {
      cookieName: AUTH_COOKIE_NAME,
      signed: false,
    },
  });

  app.decorate("authenticate", async (request: FastifyRequest) => {
    try {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        await request.jwtVerify();
        return;
      }

      const cookieToken = request.cookies[AUTH_COOKIE_NAME];
      if (cookieToken) {
        const decoded = await request.server.jwt.verify<JwtPayload>(cookieToken);
        request.user = decoded;
        return;
      }

      await request.jwtVerify();
    } catch {
      throw new AppError(401, "UNAUTHORIZED", "Invalid or missing token");
    }
  });

  app.decorate("requireAdmin", async (request: FastifyRequest) => {
    await app.authenticate(request);
    const role = request.user.role as UserRole;
    if (role !== "admin") {
      throw new AppError(403, "FORBIDDEN", "Admin access required");
    }
  });
});
