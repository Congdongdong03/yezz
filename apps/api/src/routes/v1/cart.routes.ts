import type { FastifyInstance } from "fastify";
import type { CartSessionItem } from "@yezz/db";
import { randomUUID, createHash } from "node:crypto";
import { success } from "../../lib/response.js";
import { AppError } from "../../lib/errors.js";

const CART_COOKIE = "yezz_cart_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

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
    const ipHash = hashIp(request.ip);

    // Verify ownership for existing sessions
    const existing = await app.services.cartSessions.get(sessionId);
    if (existing.items.length > 0 && existing.ipHash && existing.ipHash !== ipHash) {
      throw new AppError(403, "FORBIDDEN", "Cart session does not belong to this client");
    }

    const data = await app.services.cartSessions.save(sessionId, items, ipHash);
    return success(data);
  });
}
