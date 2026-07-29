import type { Db } from "@yezz/db";
import bcrypt from "bcryptjs";
import { AppError } from "../../lib/errors.js";
import type { JwtPayload } from "../../lib/jwt.js";
import {
  createUsersRepository,
  type UserRole,
} from "../../repositories/users.repository.js";
import { createPasswordSetupService } from "../password-setup.service.js";

export type AdminUserDto = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
};

export type AdminUsersService = ReturnType<typeof createAdminUsersService>;

export function createAdminUsersService(db: Db) {
  const repo = createUsersRepository(db);
  const passwordSetup = createPasswordSetupService(db);

  function requireOwner(actor: JwtPayload) {
    if (actor.role !== "owner") {
      throw new AppError(403, "FORBIDDEN", "Owner access required");
    }
  }

  function dto(row: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    createdAt: Date;
  }): AdminUserDto {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.createdAt,
    };
  }

  return {
    async list(): Promise<AdminUserDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map(dto);
    },

    async create(input: {
      email: string;
      name: string;
      role: UserRole;
    }, actor: JwtPayload): Promise<{ user: AdminUserDto }> {
      if (!input.email?.trim() || !input.name?.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "email and name are required");
      }
      if (!["owner", "admin", "staff"].includes(input.role)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "role must be owner, admin, or staff",
        );
      }
      if (input.role !== "staff") {
        requireOwner(actor);
      }

      const existing = await repo.findByEmail(input.email.trim().toLowerCase());
      if (existing) {
        throw new AppError(409, "CONFLICT", "Email already in use");
      }

      const row = await passwordSetup.createUserAndIssue({
        email: input.email,
        name: input.name,
        role: input.role,
      });

      return { user: dto(row) };
    },

    async update(id: string, input: {
      email?: string;
      name?: string;
      role?: UserRole;
    }, actor: JwtPayload): Promise<AdminUserDto> {
      if (input.email && !input.email.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "email cannot be empty");
      }
      if (input.name && !input.name.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "name cannot be empty");
      }
      if (input.role && !["owner", "admin", "staff"].includes(input.role)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "role must be owner, admin, or staff",
        );
      }

      const updateUser = async (tx?: Db): Promise<AdminUserDto> => {
        const existing = await repo.findById(id, tx);
        if (!existing) {
          throw new AppError(404, "NOT_FOUND", "User not found");
        }
        if (existing.role === "owner") {
          requireOwner(actor);
        }
        const roleChanges =
          input.role !== undefined && input.role !== existing.role;
        if (
          roleChanges &&
          (existing.role !== "staff" || input.role !== "staff")
        ) {
          requireOwner(actor);
        }
        if (
          roleChanges &&
          existing.role === "owner" &&
          (await repo.countByRole("owner", tx)) <= 1
        ) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "The sole owner cannot be demoted",
          );
        }

        if (input.email && input.email.trim().toLowerCase() !== existing.email) {
          const conflict = await repo.findByEmail(
            input.email.trim().toLowerCase(),
            tx,
          );
          if (conflict && conflict.id !== id) {
            throw new AppError(409, "CONFLICT", "Email already in use");
          }
        }

        const row = await repo.update(
          id,
          {
            email: input.email?.trim().toLowerCase(),
            name: input.name?.trim(),
            role: input.role,
          },
          tx,
        );
        if (!row) {
          throw new AppError(500, "INTERNAL_ERROR", "Failed to update user");
        }

        return dto(row);
      };

      return input.role === undefined
        ? updateUser()
        : repo.withOwnerMutationLock(updateUser);
    },

    async resetPassword(
      id: string,
      actor: JwtPayload,
    ): Promise<{ user: AdminUserDto }> {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }

      if (existing.role !== "staff") {
        requireOwner(actor);
      }
      await passwordSetup.issueForUser(existing);
      return { user: dto(existing) };
    },

    async changePassword(
      userId: string,
      currentPassword: unknown,
      newPassword: unknown,
    ): Promise<{ ok: true }> {
      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        newPassword.length < 12
      ) {
        throw new AppError(400, "VALIDATION_ERROR", "New password must be at least 12 characters");
      }

      const user = await repo.findByIdWithPasswordHash(userId);
      if (!user) {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        throw new AppError(400, "INVALID_CREDENTIALS", "Current password is incorrect");
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const row = await repo.updatePasswordAndIncrementSessionVersion(
        userId,
        passwordHash,
      );
      if (!row) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to change password");
      }

      return { ok: true };
    },

    async remove(id: string, actor: JwtPayload): Promise<{ id: string }> {
      if (id === actor.sub) {
        throw new AppError(400, "VALIDATION_ERROR", "Cannot delete your own account");
      }
      return repo.withOwnerMutationLock(async (tx) => {
        const existing = await repo.findById(id, tx);
        if (!existing) {
          throw new AppError(404, "NOT_FOUND", "User not found");
        }
        if (existing.role !== "staff") {
          requireOwner(actor);
        }
        if (
          existing.role === "owner" &&
          (await repo.countByRole("owner", tx)) <= 1
        ) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "The sole owner cannot be deleted",
          );
        }
        const row = await repo.delete(id, tx);
        if (!row) {
          throw new AppError(404, "NOT_FOUND", "User not found");
        }
        return { id: row.id };
      });
    },
  };
}
