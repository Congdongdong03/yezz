import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createDb, type Db } from "./client.js";
import { loadEnv } from "./env.js";
import {
  emailOutbox,
  passwordSetupTokens,
  siteSettings,
  users,
  type UserRole,
} from "./schema/index.js";

export type ProductionBootstrapEnv = Record<string, string | undefined>;

type SiteSettingsInsert = typeof siteSettings.$inferInsert;
type OwnerInsert = typeof users.$inferInsert;
type OwnerRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sessionVersion: number;
};

export type ProductionBootstrapStore = {
  transaction<T>(
    operation: (store: ProductionBootstrapStore) => Promise<T>,
  ): Promise<T>;
  acquireBootstrapLock(): Promise<void>;
  hasSiteSettings(): Promise<boolean>;
  createSiteSettings(settings: SiteSettingsInsert): Promise<void>;
  findUserByEmail(email: string): Promise<OwnerRow | null>;
  createOwner(owner: OwnerInsert): Promise<OwnerRow>;
  updateUserRole(id: string, role: "owner"): Promise<void>;
  createPasswordSetupToken(input: {
    userId: string;
    tokenDigest: string;
    expiresAt: Date;
  }): Promise<{ id: string }>;
  enqueuePasswordSetupEmail(input: {
    dedupeKey: string;
    messageType: "admin_password_setup";
    recipient: string;
    locale: "en";
    payload: Record<string, unknown>;
  }): Promise<void>;
};

type BootstrapOptions = {
  store?: ProductionBootstrapStore;
  hashPassword?: (password: string, rounds: number) => Promise<string>;
  randomBytes?: (size: number) => Buffer;
  now?: () => Date;
};

export type ProductionBootstrapResult = {
  settingsCreated: boolean;
  ownerCreated: boolean;
  setupEmailQueued: boolean;
};

const OWNER_ACCOUNT = {
  email: "congdongdong03@gmail.com",
  name: "YezYY Owner",
} as const;

const TRUTHFUL_SETTINGS: SiteSettingsInsert = {
  storeName: "YezYY",
  address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
  businessHours:
    "Monday 9:30 am–5:00 pm; Tuesday 9:30 am–5:00 pm; Wednesday 9:30 am–5:00 pm; Thursday 9:30 am–8:30 pm; Friday 9:30 am–8:30 pm; Saturday 9:30 am–5:30 pm; Sunday 10:00 am–5:00 pm",
  phone: "0430 787 712",
  email: "congdongdong03@gmail.com",
  wechatId: null,
  wechatQrUrl: null,
  heroImageUrl: null,
  instagram: null,
  xiaohongshu: "95848743904",
  googleMapUrl:
    "https://www.google.com/maps/search/?api=1&query=G082%2F235%20Springvale%20Rd%2C%20Glen%20Waverley%20VIC%203150",
  seoTitle: "YezYY",
  seoDescription:
    "A DIY studio in Glen Waverley for creative experiences, dates, birthdays, and gatherings.",
};

export function createBootstrapStore(db: Db): ProductionBootstrapStore {
  return {
    transaction(operation) {
      return db.transaction((transaction) =>
        operation(createBootstrapStore(transaction as unknown as Db)),
      );
    },
    async acquireBootstrapLock() {
      await db.execute(
        sql`select pg_advisory_xact_lock(149978, 1125)`,
      );
    },
    async hasSiteSettings() {
      const [row] = await db
        .select({ id: siteSettings.id })
        .from(siteSettings)
        .limit(1);
      return Boolean(row);
    },
    async createSiteSettings(settings) {
      await db.insert(siteSettings).values(settings);
    },
    async findUserByEmail(email) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          sessionVersion: users.sessionVersion,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ?? null;
    },
    async createOwner(owner) {
      const [row] = await db
        .insert(users)
        .values(owner)
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          sessionVersion: users.sessionVersion,
        });
      if (!row) throw new Error("Owner insert returned no row.");
      return row;
    },
    async updateUserRole(id, role) {
      await db
        .update(users)
        .set({
          role,
          sessionVersion: sql`${users.sessionVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
    },
    async createPasswordSetupToken(input) {
      const [row] = await db
        .insert(passwordSetupTokens)
        .values(input)
        .returning({ id: passwordSetupTokens.id });
      if (!row) throw new Error("Password setup token insert returned no row.");
      return row;
    },
    async enqueuePasswordSetupEmail(input) {
      await db.insert(emailOutbox).values({
        ...input,
        bookingId: null,
        cartOrderId: null,
        statusEventId: null,
      });
    },
  };
}

export async function ensureOwnerAccount(
  input: typeof OWNER_ACCOUNT,
  store: ProductionBootstrapStore,
  options: {
    hashPassword: (password: string, rounds: number) => Promise<string>;
    randomBytes: (size: number) => Buffer;
    now: () => Date;
  },
): Promise<{ ownerCreated: boolean; setupEmailQueued: boolean }> {
  const existing = await store.findUserByEmail(input.email);
  if (existing) {
    if (existing.role !== "owner") {
      await store.updateUserRole(existing.id, "owner");
    }
    return { ownerCreated: false, setupEmailQueued: false };
  }

  const bootstrapSecret = options.randomBytes(32).toString("base64url");
  const passwordHash = await options.hashPassword(bootstrapSecret, 12);
  const owner = await store.createOwner({
    email: input.email,
    passwordHash,
    name: input.name,
    role: "owner",
  });
  const rawToken = options.randomBytes(32).toString("base64url");
  const issuedAt = options.now();
  const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000);
  const token = await store.createPasswordSetupToken({
    userId: owner.id,
    tokenDigest: createHash("sha256").update(rawToken).digest("hex"),
    expiresAt,
  });
  await store.enqueuePasswordSetupEmail({
    dedupeKey: `admin-password-setup:${token.id}`,
    messageType: "admin_password_setup",
    recipient: owner.email,
    locale: "en",
    payload: {
      template: "admin_password_setup",
      name: owner.name,
      email: owner.email,
      role: owner.role,
      setupUrl: `https://yezyy.com/admin/setup-password?token=${rawToken}`,
      expiresAt: expiresAt.toISOString(),
    },
  });
  return { ownerCreated: true, setupEmailQueued: true };
}

async function bootstrapWithStore(
  store: ProductionBootstrapStore,
  hashPassword: (password: string, rounds: number) => Promise<string>,
  randomBytes: (size: number) => Buffer,
  now: () => Date,
): Promise<ProductionBootstrapResult> {
  return store.transaction(async (transaction) => {
    await transaction.acquireBootstrapLock();
    let settingsCreated = false;

    if (!(await transaction.hasSiteSettings())) {
      await transaction.createSiteSettings(TRUTHFUL_SETTINGS);
      settingsCreated = true;
    }

    const owner = await ensureOwnerAccount(OWNER_ACCOUNT, transaction, {
      hashPassword,
      randomBytes,
      now,
    });
    return { settingsCreated, ...owner };
  });
}

export async function bootstrapProduction(
  env: ProductionBootstrapEnv = process.env,
  options: BootstrapOptions = {},
): Promise<ProductionBootstrapResult> {
  if (env.ALLOW_PRODUCTION_BOOTSTRAP !== "YezYY") {
    throw new Error(
      "Production bootstrap requires ALLOW_PRODUCTION_BOOTSTRAP=YezYY.",
    );
  }

  const hashPassword = options.hashPassword ?? bcrypt.hash;
  const randomBytes = options.randomBytes ?? nodeRandomBytes;
  const now = options.now ?? (() => new Date());
  if (options.store) {
    return bootstrapWithStore(options.store, hashPassword, randomBytes, now);
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for production bootstrap.");
  }

  const { db, client } = createDb(databaseUrl);
  try {
    return await bootstrapWithStore(
      createBootstrapStore(db),
      hashPassword,
      randomBytes,
      now,
    );
  } finally {
    await client.end();
  }
}

async function runFromCommandLine() {
  loadEnv();
  const result = await bootstrapProduction(process.env);
  console.log(
    `Production bootstrap complete (settings: ${result.settingsCreated ? "created" : "existing"}, owner: ${result.ownerCreated ? "created" : "existing"}, setup email: ${result.setupEmailQueued ? "queued" : "unchanged"}).`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runFromCommandLine().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown production bootstrap error";
    console.error(message);
    process.exitCode = 1;
  });
}
