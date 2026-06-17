import type { Db } from "@yezz/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { AppError } from "../../lib/errors.js";
import { sendStaffWelcomeEmail } from "../../lib/email.js";
import {
  createUsersRepository,
  type UserRole,
} from "../../repositories/users.repository.js";

export type AdminUserDto = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
};

export type AdminUsersService = ReturnType<typeof createAdminUsersService>;

function generatePassword() {
  return randomBytes(9).toString("base64url");
}

export function createAdminUsersService(db: Db) {
  const repo = createUsersRepository(db);

  return {
    async list(): Promise<AdminUserDto[]> {
      const rows = await repo.findAllOrdered();
      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.createdAt,
      }));
    },

    async create(input: {
      email: string;
      name: string;
      role: UserRole;
      password?: string;
    }): Promise<{ user: AdminUserDto }> {
      if (!input.email?.trim() || !input.name?.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "email and name are required");
      }
      if (!["admin", "staff"].includes(input.role)) {
        throw new AppError(400, "VALIDATION_ERROR", "role must be admin or staff");
      }

      const existing = await repo.findByEmail(input.email.trim().toLowerCase());
      if (existing) {
        throw new AppError(409, "CONFLICT", "Email already in use");
      }

      const initialPassword = input.password?.trim() || generatePassword();
      const passwordHash = await bcrypt.hash(initialPassword, 10);
      const row = await repo.create({
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
      });

      try {
        await sendStaffWelcomeEmail({
          to: row.email,
          name: row.name,
          email: row.email,
          password: initialPassword,
          role: row.role,
        });
      } catch (error) {
        console.error("Staff welcome email failed:", error);
      }

      return {
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          createdAt: row.createdAt,
        },
      };
    },

    async update(id: string, input: {
      email?: string;
      name?: string;
      role?: UserRole;
    }): Promise<AdminUserDto> {
      if (input.email && !input.email.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "email cannot be empty");
      }
      if (input.name && !input.name.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "name cannot be empty");
      }
      if (input.role && !["admin", "staff"].includes(input.role)) {
        throw new AppError(400, "VALIDATION_ERROR", "role must be admin or staff");
      }

      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }

      if (input.email && input.email.trim().toLowerCase() !== existing.email) {
        const conflict = await repo.findByEmail(input.email.trim().toLowerCase());
        if (conflict && conflict.id !== id) {
          throw new AppError(409, "CONFLICT", "Email already in use");
        }
      }

      const row = await repo.update(id, {
        email: input.email?.trim().toLowerCase(),
        name: input.name?.trim(),
        role: input.role,
      });
      if (!row) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to update user");
      }

      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.createdAt,
      };
    },

    async resetPassword(id: string): Promise<{ user: AdminUserDto }> {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }

      const newPassword = generatePassword();
      const passwordHash = await bcrypt.hash(newPassword, 10);

      const row = await repo.update(id, { passwordHash });
      if (!row) {
        throw new AppError(500, "INTERNAL_ERROR", "Failed to reset password");
      }

      try {
        await sendStaffWelcomeEmail({
          to: row.email,
          name: row.name,
          email: row.email,
          password: newPassword,
          role: row.role,
        });
      } catch (error) {
        console.error("Password reset email failed:", error);
      }

      return {
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          createdAt: row.createdAt,
        },
      };
    },

    async remove(id: string, currentUserId: string): Promise<{ id: string }> {
      if (id === currentUserId) {
        throw new AppError(400, "VALIDATION_ERROR", "Cannot delete your own account");
      }
      const row = await repo.delete(id);
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }
      return { id: row.id };
    },
  };
}
