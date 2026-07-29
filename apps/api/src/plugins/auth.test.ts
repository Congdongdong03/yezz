import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const users = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock("../repositories/users.repository.js", () => ({
  createUsersRepository: () => users,
}));

import authPlugin from "./auth.js";

describe("auth plugin session invalidation", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-session-version-secret";
    users.findById.mockReset().mockResolvedValue({
      id: "owner-1",
      email: "owner@example.com",
      name: "Owner",
      role: "owner",
      sessionVersion: 2,
      createdAt: new Date("2030-08-01T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  async function buildProtectedApp() {
    const app = Fastify();
    app.decorate("db", {} as never);
    await app.register(authPlugin);
    app.get("/protected", { onRequest: app.authenticate }, async () => ({
      ok: true,
    }));
    return app;
  }

  it("rejects a correctly signed JWT after the stored session version changes", async () => {
    const app = await buildProtectedApp();
    const token = app.jwt.sign({
      sub: "owner-1",
      email: "owner@example.com",
      role: "owner",
      sessionVersion: 1,
    } as never);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("accepts a JWT whose session version matches the current user row", async () => {
    const app = await buildProtectedApp();
    const token = app.jwt.sign({
      sub: "owner-1",
      email: "owner@example.com",
      role: "owner",
      sessionVersion: 2,
    } as never);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
