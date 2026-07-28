import cookie from "@fastify/cookie";
import { createHash, createHmac } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerInternalRequestProtection } from "../../lib/internal-request.js";
import type { AppServices } from "../../plugins/services.js";
import cartRoutes from "./cart.routes.js";

const SECRET = "0123456789abcdef0123456789abcdef";
const CUSTOMER_IP = "203.0.113.4";
const TIMESTAMP = 1_785_200_000;
const SESSION_ID = "00000000-0000-4000-8000-000000000010";

function signedHeaders(body: Uint8Array): Record<string, string> {
  const bodyDigest = createHash("sha256").update(body).digest("hex");
  const requestId = "00000000-0000-4000-8000-000000000001";
  const canonical = [
    "PUT",
    "/api/v1/cart",
    requestId,
    String(TIMESTAMP),
    CUSTOMER_IP,
    "",
    bodyDigest,
  ].join("\n");
  return {
    "content-type": "application/json",
    cookie: `yezz_cart_session=${SESSION_ID}`,
    "x-forwarded-for": "198.51.100.99",
    "x-yezyy-body-sha256": bodyDigest,
    "x-yezyy-client-ip": CUSTOMER_IP,
    "x-yezyy-request-id": requestId,
    "x-yezyy-request-timestamp": String(TIMESTAMP),
    "x-yezyy-signature": createHmac("sha256", SECRET)
      .update(canonical)
      .digest("hex"),
  };
}

describe("cart session ownership identity", () => {
  it("uses the stable signed customer IP instead of remote or spoofed forwarding addresses", async () => {
    const item = {
      projectId: "project-1",
      projectSlug: "project",
      projectName: { en: "Project", zh: "项目" },
      projectType: "product" as const,
    };
    const expectedIpHash = createHash("sha256").update(CUSTOMER_IP).digest("hex");
    const savedHashes: Array<string | null | undefined> = [];
    const cartSessions = {
      async get() {
        return {
          id: SESSION_ID,
          ipHash: expectedIpHash,
          items: [item],
        };
      },
      async save(
        _sessionId: string,
        _items: typeof item[],
        ipHash?: string | null,
      ) {
        savedHashes.push(ipHash);
        return { id: SESSION_ID, items: [item] };
      },
      async purgeExpired() {},
    };

    const app = Fastify({ logger: false });
    registerInternalRequestProtection(app, {
      enforcement: "require",
      secrets: SECRET,
      now: () => TIMESTAMP,
    });
    await app.register(cookie);
    app.decorate("services", {
      cartSessions,
    } as unknown as AppServices);
    await app.register(cartRoutes, { prefix: "/api/v1/cart" });

    const body = new TextEncoder().encode(JSON.stringify({ items: [item] }));
    for (const remoteAddress of ["10.0.0.1", "10.0.0.2"]) {
      const response = await app.inject({
        method: "PUT",
        url: "/api/v1/cart",
        remoteAddress,
        headers: signedHeaders(body),
        payload: Buffer.from(body),
      });
      expect(response.statusCode).toBe(200);
    }
    expect(savedHashes).toEqual([expectedIpHash, expectedIpHash]);

    await app.close();
  });
});
