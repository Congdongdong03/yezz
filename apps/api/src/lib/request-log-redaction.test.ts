import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { serializeRequestForLog } from "./request-log-redaction.js";

const token = "A".repeat(43);

describe("customer booking request log redaction", () => {
  it.each([
    `/api/v1/customer-bookings/${token}`,
    `/api/v1/customer-bookings/${token}/request-cancellation`,
  ])("does not emit a bearer token for %s", (url) => {
    const logged = serializeRequestForLog({ id: "request-1", method: "POST", url });

    expect(JSON.stringify(logged)).not.toContain(token);
    expect(logged).toEqual({
      requestId: "request-1",
      method: "POST",
      url: "/api/v1/customer-bookings/:token",
    });
  });

  it("redacts a customer token in the real Fastify request logger", async () => {
    const entries: string[] = [];
    const app = Fastify({
      logger: {
        level: "info",
        serializers: { req: serializeRequestForLog },
        stream: {
          write(chunk: string) {
            entries.push(chunk);
          },
        },
      },
    });
    app.get("/api/v1/customer-bookings/:token", async (request) => {
      request.log.info({ req: request }, "customer booking loaded");
      return { ok: true };
    });

    await app.inject({
      method: "GET",
      url: `/api/v1/customer-bookings/${token}`,
    });
    await app.close();

    const logs = entries.join("");
    expect(logs).not.toContain(token);
    expect(logs).toContain("/api/v1/customer-bookings/:token");
  });
});
