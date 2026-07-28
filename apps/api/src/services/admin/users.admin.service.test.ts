import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByIdWithPasswordHash: vi.fn(),
  findAllOrdered: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const sendStaffWelcomeEmail = vi.hoisted(() => vi.fn());

vi.mock("../../repositories/users.repository.js", () => ({
  createUsersRepository: () => repo,
}));

vi.mock("../../lib/email.js", () => ({
  sendStaffWelcomeEmail,
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
    repo.findByEmail.mockResolvedValue(null);
    repo.create.mockResolvedValue(user);
    repo.update.mockResolvedValue(user);
  });

  it("returns the generated initial password to the authenticated admin caller", async () => {
    const service = createAdminUsersService({} as never);
    let storedPasswordHash = "";
    repo.create.mockImplementation(async (input) => {
      storedPasswordHash = input.passwordHash;
      return user;
    });

    const result = await service.create({
      email: "staff@example.com",
      name: "Staff",
      role: "staff",
    });

    expect(result.initialPassword).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(await bcrypt.compare(result.initialPassword, storedPasswordHash)).toBe(true);
  });

  it("does not pass a plaintext password to the welcome email", async () => {
    const service = createAdminUsersService({} as never);

    await service.create({
      email: "staff@example.com",
      name: "Staff",
      role: "staff",
      password: "SafeTemporary42!",
    });

    expect(sendStaffWelcomeEmail).toHaveBeenCalledWith({
      to: "staff@example.com",
      name: "Staff",
      email: "staff@example.com",
      role: "staff",
    });
    expect(sendStaffWelcomeEmail.mock.calls[0]?.[0]).not.toHaveProperty("password");
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
    repo.update.mockImplementation(async (_id, input) => {
      storedPasswordHash = input.passwordHash;
      return user;
    });

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
});
