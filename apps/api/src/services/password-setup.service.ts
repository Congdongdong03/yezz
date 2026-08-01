import { sealPasswordSetupToken, type Db, type UserRole } from "@yezz/db";
import bcrypt from "bcryptjs";
import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import { AppError } from "../lib/errors.js";
import { createEmailOutboxRepository } from "../repositories/email-outbox.repository.js";
import {
  createPasswordSetupTokensRepository,
  type PasswordSetupTokensRepository,
} from "../repositories/password-setup-tokens.repository.js";
import {
  createUsersRepository,
  type UserRole as ApiUserRole,
} from "../repositories/users.repository.js";

const TOKEN_LIFETIME_MILLISECONDS = 60 * 60 * 1000;
type SetupUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

type PasswordSetupOptions = {
  tokens?: PasswordSetupTokensRepository;
  users?: ReturnType<typeof createUsersRepository>;
  outbox?: Pick<ReturnType<typeof createEmailOutboxRepository>, "enqueue">;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
  hashPassword?: (password: string, rounds: number) => Promise<string>;
  sealSetupToken?: (rawToken: string) => string;
};

function digestToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function invalidSetupToken(): AppError {
  return new AppError(
    400,
    "SETUP_TOKEN_INVALID_OR_EXPIRED",
    "This setup link is invalid, expired, or already used",
  );
}

function setupIssueFailed(): AppError {
  return new AppError(
    500,
    "PASSWORD_SETUP_ISSUE_FAILED",
    "Password setup could not be queued",
  );
}

function setupCompletionFailed(): AppError {
  return new AppError(
    500,
    "PASSWORD_SETUP_FAILED",
    "Password setup could not be completed",
  );
}

export function createPasswordSetupService(
  db: Db,
  options: PasswordSetupOptions = {},
) {
  const tokens =
    options.tokens ?? createPasswordSetupTokensRepository(db);
  const users = options.users ?? createUsersRepository(db);
  const outbox = options.outbox ?? createEmailOutboxRepository(db);
  const now = options.now ?? (() => new Date());
  const randomBytes = options.randomBytes ?? nodeRandomBytes;
  const hashPassword = options.hashPassword ?? bcrypt.hash;
  const sealSetupToken =
    options.sealSetupToken ??
    ((rawToken: string) =>
      sealPasswordSetupToken(
        rawToken,
        process.env.PASSWORD_SETUP_TOKEN_SECRET,
      ));

  async function issueInTransaction(user: SetupUser, tx: Db) {
    await tokens.lockForIssue(user.id, tx);
    const issuedAt = now();
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      issuedAt.getTime() + TOKEN_LIFETIME_MILLISECONDS,
    );

    await tokens.revokeActiveForUser(user.id, issuedAt, tx);
    const token = await tokens.create(
      {
        userId: user.id,
        tokenDigest: digestToken(rawToken),
        expiresAt,
      },
      tx,
    );
    await outbox.enqueue(
      {
        dedupeKey: `admin-password-setup:${token.id}`,
        bookingId: null,
        cartOrderId: null,
        statusEventId: null,
        messageType: "admin_password_setup",
        recipient: user.email,
        locale: "en",
        payload: {
          template: "admin_password_setup",
          name: user.name,
          email: user.email,
          role: user.role,
          sealedSetupToken: sealSetupToken(rawToken),
          expiresAt: expiresAt.toISOString(),
        },
      },
      tx,
    );
  }

  async function issueForUser(user: SetupUser): Promise<void> {
    try {
      await db.transaction((transaction) =>
        issueInTransaction(user, transaction as unknown as Db),
      );
    } catch {
      throw setupIssueFailed();
    }
  }

  return {
    async requestForEmail(email: unknown): Promise<{ ok: true }> {
      if (typeof email !== "string") return { ok: true };

      const normalizedEmail = email.normalize("NFKC").trim().toLowerCase();
      if (
        !normalizedEmail ||
        normalizedEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        return { ok: true };
      }

      const user = await users.findByEmail(normalizedEmail);
      if (!user) return { ok: true };

      await issueForUser(user);
      return { ok: true };
    },

    async createUserAndIssue(input: {
      email: string;
      name: string;
      role: ApiUserRole;
    }) {
      try {
        return await db.transaction(async (transaction) => {
          const bootstrapPassword = randomBytes(32).toString("base64url");
          const passwordHash = await hashPassword(bootstrapPassword, 12);
          const user = await users.create(
            { ...input, passwordHash },
            transaction as unknown as Db,
          );
          await issueInTransaction(user, transaction as unknown as Db);
          return user;
        });
      } catch {
        throw setupIssueFailed();
      }
    },

    async issueForUser(user: SetupUser): Promise<void> {
      await issueForUser(user);
    },

    async complete(rawToken: unknown, newPassword: unknown): Promise<{ ok: true }> {
      if (typeof newPassword !== "string" || newPassword.length < 12) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Password must be at least 12 characters",
        );
      }
      try {
        const passwordHash = await hashPassword(newPassword, 12);
        if (
          typeof rawToken !== "string" ||
          !/^[A-Za-z0-9_-]{43}$/.test(rawToken)
        ) {
          throw invalidSetupToken();
        }

        return await db.transaction(async (transaction) => {
          const tx = transaction as unknown as Db;
          const token = await tokens.findActiveByDigestForUpdate(
            digestToken(rawToken),
            now(),
            tx,
          );
          if (!token) throw invalidSetupToken();

          const completedAt = now();
          const updatedUser =
            await users.updatePasswordAndIncrementSessionVersion(
              token.userId,
              passwordHash,
              tx,
            );
          const used = await tokens.markUsed(token.id, completedAt, tx);
          if (!updatedUser || !used) throw invalidSetupToken();
          await tokens.revokeActiveForUser(
            token.userId,
            completedAt,
            tx,
            token.id,
          );
          return { ok: true };
        });
      } catch (error) {
        if (
          error instanceof AppError &&
          error.code === "SETUP_TOKEN_INVALID_OR_EXPIRED"
        ) {
          throw error;
        }
        throw setupCompletionFailed();
      }
    },
  };
}

export type PasswordSetupService = ReturnType<
  typeof createPasswordSetupService
>;
