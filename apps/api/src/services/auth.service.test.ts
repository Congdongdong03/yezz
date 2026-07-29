import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const users = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("../repositories/users.repository.js", () => ({
  createUsersRepository: () => users,
}));

import { createAuthService } from "./auth.service.js";

describe("auth service session version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs the exact current user session version and owner role", async () => {
    users.findByEmail.mockResolvedValue({
      id: "owner-1",
      email: "congdongdong03@gmail.com",
      passwordHash: await bcrypt.hash("OwnerPassword42!", 10),
      name: "YezYY Owner",
      role: "owner",
      sessionVersion: 7,
      createdAt: new Date("2030-08-01T00:00:00.000Z"),
    });
    const signToken = vi.fn(() => "signed-token");
    const service = createAuthService({} as never);

    await expect(
      service.login(
        "congdongdong03@gmail.com",
        "OwnerPassword42!",
        signToken,
      ),
    ).resolves.toMatchObject({
      token: "signed-token",
      user: { role: "owner" },
    });
    expect(signToken).toHaveBeenCalledWith({
      sub: "owner-1",
      email: "congdongdong03@gmail.com",
      role: "owner",
      sessionVersion: 7,
    });
  });
});
