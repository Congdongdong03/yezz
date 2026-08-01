import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createPasswordSetupService } from "./password-setup.service.js";

const NOW = new Date("2030-08-01T00:00:00.000Z");
const RAW_TOKEN = Buffer.alloc(32, 7).toString("base64url");
const TOKEN_DIGEST = createHash("sha256").update(RAW_TOKEN).digest("hex");

function createDependencies() {
  const transaction = vi.fn(async (operation) => operation({} as never));
  const tokens = {
    lockForIssue: vi.fn(async () => undefined),
    create: vi.fn(async (input) => ({
      id: "token-1",
      createdAt: NOW,
      usedAt: null,
      revokedAt: null,
      ...input,
    })),
    findActiveByDigestForUpdate: vi.fn(),
    markUsed: vi.fn(async () => ({ id: "token-1" })),
    revokeActiveForUser: vi.fn(async () => undefined),
  };
  const users = {
    findByEmail: vi.fn(async () => null),
    create: vi.fn(async (input) => ({
      id: "user-1",
      email: input.email,
      name: input.name,
      role: input.role,
      sessionVersion: 0,
      createdAt: NOW,
    })),
    updatePasswordAndIncrementSessionVersion: vi.fn(async () => ({
      id: "user-1",
      sessionVersion: 4,
    })),
  };
  const outbox = {
    enqueue: vi.fn(async (input) => input),
  };
  const hashPassword = vi.fn(async () => "bcrypt-hash");
  const service = createPasswordSetupService(
    { transaction } as never,
    {
      tokens: tokens as never,
      users: users as never,
      outbox: outbox as never,
      now: () => NOW,
      randomBytes: () => Buffer.alloc(32, 7),
      hashPassword,
      sealSetupToken: () => "v1.aXZfaXZfaXZfaXZf.Y2lwaGVydGV4dA.dGFnX3RhZ190YWdfdGFnXw",
    },
  );
  return { service, transaction, tokens, users, outbox, hashPassword };
}

describe("password setup service", () => {
  it("normalizes an existing administrator email and queues a replacement link", async () => {
    const { service, users, tokens, outbox } = createDependencies();
    users.findByEmail.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "YezYY Owner",
      role: "owner",
      sessionVersion: 3,
      createdAt: NOW,
      passwordHash: "existing-hash",
    } as never);

    await expect(
      service.requestForEmail("  Owner@Example.COM  "),
    ).resolves.toEqual({ ok: true });

    expect(users.findByEmail).toHaveBeenCalledWith("owner@example.com");
    expect(tokens.revokeActiveForUser).toHaveBeenCalledWith(
      "user-1",
      NOW,
      expect.anything(),
    );
    expect(tokens.lockForIssue).toHaveBeenCalledWith(
      "user-1",
      expect.anything(),
    );
    expect(tokens.lockForIssue.mock.invocationCallOrder[0]).toBeLessThan(
      tokens.revokeActiveForUser.mock.invocationCallOrder[0],
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: "owner@example.com",
        messageType: "admin_password_setup",
        payload: expect.objectContaining({
          sealedSetupToken: expect.any(String),
        }),
      }),
      expect.anything(),
    );
    expect(JSON.stringify(outbox.enqueue.mock.calls)).not.toContain(RAW_TOKEN);
  });

  it.each(["missing@example.com", "", null])(
    "returns the same response without issuing a link for %j",
    async (email) => {
      const { service, users, tokens, outbox } = createDependencies();

      await expect(service.requestForEmail(email)).resolves.toEqual({
        ok: true,
      });

      if (typeof email === "string" && email.trim()) {
        expect(users.findByEmail).toHaveBeenCalledWith(email);
      } else {
        expect(users.findByEmail).not.toHaveBeenCalled();
      }
      expect(tokens.create).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    },
  );

  it("creates a user with an unreturned bootstrap secret and queues a 60-minute setup link", async () => {
    const { service, tokens, users, outbox } = createDependencies();

    const result = await service.createUserAndIssue({
      email: "congdongdong03@gmail.com",
      name: "YezYY Owner",
      role: "owner",
    });

    expect(result).toEqual({
      id: "user-1",
      email: "congdongdong03@gmail.com",
      name: "YezYY Owner",
      role: "owner",
      sessionVersion: 0,
      createdAt: NOW,
    });
    expect(JSON.stringify(result)).not.toMatch(/password|token/i);
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "congdongdong03@gmail.com",
        name: "YezYY Owner",
        role: "owner",
        passwordHash: expect.any(String),
      }),
      expect.anything(),
    );
    expect(tokens.create).toHaveBeenCalledWith(
      {
        userId: "user-1",
        tokenDigest: TOKEN_DIGEST,
        expiresAt: new Date("2030-08-01T01:00:00.000Z"),
      },
      expect.anything(),
    );
    expect(JSON.stringify(tokens.create.mock.calls)).not.toContain(RAW_TOKEN);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "admin_password_setup",
        recipient: "congdongdong03@gmail.com",
        payload: expect.objectContaining({
          template: "admin_password_setup",
          sealedSetupToken: expect.any(String),
        }),
      }),
      expect.anything(),
    );
    expect(JSON.stringify(outbox.enqueue.mock.calls)).not.toContain(RAW_TOKEN);
  });

  it("revokes previous tokens before issuing a replacement", async () => {
    const { service, tokens } = createDependencies();

    await service.issueForUser({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      role: "staff",
    });

    expect(tokens.revokeActiveForUser).toHaveBeenCalledWith(
      "user-1",
      NOW,
      expect.anything(),
    );
    expect(tokens.revokeActiveForUser.mock.invocationCallOrder[0]).toBeLessThan(
      tokens.create.mock.invocationCallOrder[0],
    );
  });

  it("uses a token once, changes the password, revokes siblings, and increments sessions atomically", async () => {
    const { service, tokens, users, hashPassword } = createDependencies();
    tokens.findActiveByDigestForUpdate.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      tokenDigest: TOKEN_DIGEST,
      expiresAt: new Date("2030-08-01T01:00:00.000Z"),
      usedAt: null,
      revokedAt: null,
      createdAt: NOW,
    });

    await expect(
      service.complete(RAW_TOKEN, "NewOwnerPassword42!"),
    ).resolves.toEqual({ ok: true });

    expect(hashPassword).toHaveBeenCalledWith("NewOwnerPassword42!", 12);
    expect(users.updatePasswordAndIncrementSessionVersion).toHaveBeenCalledWith(
      "user-1",
      "bcrypt-hash",
      expect.anything(),
    );
    expect(tokens.markUsed).toHaveBeenCalledWith(
      "token-1",
      NOW,
      expect.anything(),
    );
    expect(tokens.revokeActiveForUser).toHaveBeenCalledWith(
      "user-1",
      NOW,
      expect.anything(),
      "token-1",
    );
  });

  it.each([
    ["invalid", "x".repeat(43)],
    ["expired", RAW_TOKEN],
    ["used", RAW_TOKEN],
    ["revoked", RAW_TOKEN],
  ])("rejects an %s token with the same non-enumerating error", async (_case, token) => {
    const { service, tokens, users } = createDependencies();
    tokens.findActiveByDigestForUpdate.mockResolvedValue(null);

    await expect(
      service.complete(token, "NewOwnerPassword42!"),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "SETUP_TOKEN_INVALID_OR_EXPIRED",
      message: "This setup link is invalid, expired, or already used",
    });
    expect(users.updatePasswordAndIncrementSessionVersion).not.toHaveBeenCalled();
  });

  it("requires a password of at least 12 characters before token lookup", async () => {
    const { service, tokens } = createDependencies();

    await expect(service.complete(RAW_TOKEN, "too-short")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
    expect(tokens.findActiveByDigestForUpdate).not.toHaveBeenCalled();
  });

  it("replaces storage errors that could contain setup secrets with a safe error", async () => {
    const { service, outbox } = createDependencies();
    outbox.enqueue.mockRejectedValue(
      new Error(
        `failing row contains https://yezyy.com/admin/setup-password?token=${RAW_TOKEN}`,
      ),
    );

    await expect(
      service.issueForUser({
        id: "user-1",
        email: "staff@example.com",
        name: "Staff",
        role: "staff",
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      code: "PASSWORD_SETUP_ISSUE_FAILED",
      message: "Password setup could not be queued",
    });
  });
});
