import type { FastifyInstance } from "fastify";
import type { CartSessionItem } from "@yezz/db";
import { randomUUID } from "node:crypto";
import { success } from "../../lib/response.js";

const CART_COOKIE = "yezz_cart_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getOrCreateSessionId(request: Parameters<typeof getSessionId>[0], reply: { setCookie: (name: string, value: string, opts: object) => void }): string {
  const existing = request.cookies?.[CART_COOKIE];
  if (existing?.trim()) return existing.trim();
  const id = randomUUID();
  reply.setCookie(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return id;
}

function getSessionId(request: { cookies?: Record<string, string | undefined> }): string | null {
  return request.cookies?.[CART_COOKIE]?.trim() ?? null;
}

export default async function cartRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return success({ id: null, items: [] as CartSessionItem[] });
    }
    const data = await app.services.cartSessions.get(sessionId);
    return success(data);
  });

  app.put<{ Body: { items?: CartSessionItem[] } }>("/", async (request, reply) => {
    const sessionId = getOrCreateSessionId(request, reply);
    const items = request.body?.items ?? [];
    const data = await app.services.cartSessions.save(sessionId, items);
    return success(data);
  });
}
