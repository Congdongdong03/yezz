import { describe, expect, it, vi } from "vitest";
import { getOperationalHealth } from "./health.service.js";

function appWithEmailState(failedCount: number, stalledCount: number) {
  const sql = vi
    .fn()
    .mockResolvedValueOnce([{ ok: 1 }])
    .mockResolvedValueOnce([{ failedCount, stalledCount }]);
  return {
    sql,
    redis: { ping: vi.fn().mockResolvedValue("PONG") },
  };
}

describe("operational health", () => {
  it("is healthy when infrastructure and email delivery are healthy", async () => {
    await expect(
      getOperationalHealth(appWithEmailState(0, 0) as never),
    ).resolves.toEqual({
      status: "ok",
      db: "ok",
      redis: "ok",
      emailDelivery: "ok",
    });
  });

  it("degrades when an email has permanently failed", async () => {
    await expect(
      getOperationalHealth(appWithEmailState(1, 0) as never),
    ).resolves.toMatchObject({
      status: "degraded",
      emailDelivery: "error",
    });
  });

  it("degrades when queued email has stalled", async () => {
    await expect(
      getOperationalHealth(appWithEmailState(0, 1) as never),
    ).resolves.toMatchObject({
      status: "degraded",
      emailDelivery: "error",
    });
  });
});
