import type { Db } from "@yezz/db";
import bcrypt from "bcryptjs";
import { AppError } from "../lib/errors.js";
import type { JwtPayload } from "../lib/jwt.js";
import { createUsersRepository } from "../repositories/users.repository.js";

export type AuthUserDto = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
};

export type LoginResultDto = {
  token: string;
  user: AuthUserDto;
};

export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService(db: Db) {
  const usersRepo = createUsersRepository(db);

  return {
    async login(
      email: string,
      password: string,
      signToken: (payload: JwtPayload) => string,
    ): Promise<LoginResultDto> {
      if (!email?.trim() || !password) {
        throw new AppError(400, "VALIDATION_ERROR", "Email and password are required");
      }

      const user = await usersRepo.findByEmail(email.trim().toLowerCase());
      if (!user) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
      }

      const token = signToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    },

    async getMe(userId: string): Promise<AuthUserDto> {
      const user = await usersRepo.findById(userId);
      if (!user) {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    },
  };
}
