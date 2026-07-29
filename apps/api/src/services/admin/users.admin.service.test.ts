import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  withOwnerMutationLock: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByIdWithPasswordHash: vi.fn(),
  findAllOrdered: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updatePasswordAndIncrementSessionVersion: vi.fn(),
  delete: vi.fn(),
  countByRole: vi.fn(),
}));

const passwordSetup = vi.hoisted(() => ({
  createUserAndIssue: vi.fn(),
  issueForUser: vi.fn(),
}));

vi.mock("../../repositories/users.repository.js", () => ({
  createUsersRepository: () => repo,
}));

vi.mock("../password-setup.service.js", () => ({
  createPasswordSetupService: () => passwordSetup,
}));

import { createAdminUsersService } from "./users.admin.service.js";

const user = {
  id: "user-1",
  email: "staff@example.com",
  name: "Staff",
  role: "staff" as const,
  createdAt: new Date("2026-07-28T00:00:00.000Z"),
};

describe("admin users service password lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.withOwnerMutationLock.mockImplementation((operation) =>
      operation(undefined),
    );
    repo.findByEmail.mockResolvedValue(null);
    repo.create.mockResolvedValue(user);
    repo.update.mockResolvedValue(user);
    repo.updatePasswordAndIncrementSessionVersion.mockResolvedValue({
      id: user.id,
      sessionVersion: 1,
    });
    passwordSetup.createUserAndIssue.mockResolvedValue({
      ...user,
      sessionVersion: 0,
    });
    passwordSetup.issueForUser.mockResolvedValue(undefined);
  });

  it("returns no plaintext password when creating a user", async () => {
    const service = createAdminUsersService({} as never);

    const result = await service.create({
      email: "staff@example.com",
      name: "Staff",
      role: "staff",
    }, {
      sub: "owner-1",
      email: "owner@example.com",
      role: "owner",
      sessionVersion: 0,
    });

    expect(result).toEqual({ user });
    expect(JSON.stringify(result)).not.toMatch(/password/i);
  });

  it("does not accept or pass a plaintext password during user creation", async () => {
    const service = createAdminUsersService({} as never);

    await service.create({
      email: "staff@example.com",
      name: "Staff",
      role: "staff",
    }, {
      sub: "owner-1",
      email: "owner@example.com",
      role: "owner",
      sessionVersion: 0,
    });

    expect(passwordSetup.createUserAndIssue).toHaveBeenCalledWith({
      email: "staff@example.com",
      name: "Staff",
      role: "staff",
    });
    expect(
      JSON.stringify(passwordSetup.createUserAndIssue.mock.calls),
    ).not.toMatch(/password/i);
  });

  it("rejects an incorrect current password", async () => {
    const service = createAdminUsersService({} as never);
    repo.findByIdWithPasswordHash.mockResolvedValue({
      ...user,
      passwordHash: await bcrypt.hash("CurrentPassword42!", 10),
    });

    await expect(
      service.changePassword(user.id, "wrong", "NewPassword42!"),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_CREDENTIALS" });
  });

  it("stores a valid replacement password", async () => {
    const service = createAdminUsersService({} as never);
    let storedPasswordHash = "";
    repo.findByIdWithPasswordHash.mockResolvedValue({
      ...user,
      passwordHash: await bcrypt.hash("CurrentPassword42!", 10),
    });
    repo.updatePasswordAndIncrementSessionVersion.mockImplementation(
      async (_id, passwordHash) => {
        storedPasswordHash = passwordHash;
        return { id: user.id, sessionVersion: 1 };
      },
    );

    await expect(
      service.changePassword(user.id, "CurrentPassword42!", "NewPassword42!"),
    ).resolves.toEqual({ ok: true });
    expect(await bcrypt.compare("NewPassword42!", storedPasswordHash)).toBe(true);
  });

  it("requires replacement passwords to be at least 12 characters", async () => {
    const service = createAdminUsersService({} as never);

    await expect(
      service.changePassword(user.id, "CurrentPassword42!", "too-short"),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(repo.findByIdWithPasswordHash).not.toHaveBeenCalled();
  });

  it("allows only an owner to create another admin", async () => {
    const service = createAdminUsersService({} as never);

    await expect(
      service.create(
        {
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
        },
        {
          sub: "admin-1",
          email: "admin-1@example.com",
          role: "admin",
          sessionVersion: 0,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(passwordSetup.createUserAndIssue).not.toHaveBeenCalled();
  });

  it("prevents the sole owner from demoting themselves", async () => {
    const service = createAdminUsersService({} as never);
    repo.findById.mockResolvedValue({
      ...user,
      id: "owner-1",
      email: "owner@example.com",
      role: "owner",
    });
    repo.countByRole.mockResolvedValue(1);

    await expect(
      service.update(
        "owner-1",
        { role: "admin" },
        {
          sub: "owner-1",
          email: "owner@example.com",
          role: "owner",
          sessionVersion: 0,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("prevents an admin from modifying an owner account", async () => {
    const service = createAdminUsersService({} as never);
    repo.findById.mockResolvedValue({
      ...user,
      id: "owner-1",
      email: "owner@example.com",
      role: "owner",
    });

    await expect(
      service.update(
        "owner-1",
        { name: "Changed by admin" },
        {
          sub: "admin-1",
          email: "admin@example.com",
          role: "admin",
          sessionVersion: 0,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it.each([
    [{ value: "not-a-password" }, "NewPassword42!"],
    [["not-a-password"], "NewPassword42!"],
    [123456789012, "NewPassword42!"],
    ["CurrentPassword42!", { value: "not-a-password" }],
    ["CurrentPassword42!", ["not-a-password"]],
    ["CurrentPassword42!", 123456789012],
  ])("rejects non-string password fields without changing the stored hash", async (currentPassword, newPassword) => {
    const service = createAdminUsersService({} as never);
    const originalHash = await bcrypt.hash("CurrentPassword42!", 10);
    let storedPasswordHash = originalHash;
    repo.findByIdWithPasswordHash.mockResolvedValue({ ...user, passwordHash: originalHash });
    repo.updatePasswordAndIncrementSessionVersion.mockImplementation(
      async (_id, passwordHash) => {
        storedPasswordHash = passwordHash;
        return { id: user.id, sessionVersion: 1 };
      },
    );

    await expect(
      service.changePassword(user.id, currentPassword, newPassword),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(repo.updatePasswordAndIncrementSessionVersion).not.toHaveBeenCalled();
    expect(storedPasswordHash).toBe(originalHash);
  });
});
